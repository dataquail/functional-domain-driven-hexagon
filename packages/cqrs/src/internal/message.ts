import type * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";

import type { Middleware } from "../middleware.js";
import * as Transport from "./transport-rpc.js";

// Machinery shared by the write side and the read side. Dispatching a command and
// dispatching a query differ in exactly two ways — the side they belong to and the
// span they open — so the transport wiring lives here once and `Command` / `Query`
// are thin facades over it. Keeping them as separate facades rather than one API is
// deliberate: `Side` is what makes a query group unusable where a command group is
// expected, which is the CQRS distinction expressed in types.
//
// Private to the package. Consumers reach `Command` and `Query`, never this.

export type TypeId = "~@org/cqrs/Message";
const TypeId: TypeId = "~@org/cqrs/Message";

export type GroupTypeId = "~@org/cqrs/MessageGroup";
const GroupTypeId: GroupTypeId = "~@org/cqrs/MessageGroup";

/**
 * The three channels a message declares, kept as plain schemas.
 *
 * Held here rather than read back off the transport: asking what a message's
 * contract is must not depend on which transport happens to be carrying it, and
 * a checker that reached into the transport to find out would couple the one
 * thing this package exists to keep swappable.
 */
export interface Schemas {
  readonly payload: Schema.Top;
  readonly success: Schema.Top;
  readonly failure: Schema.Top;
}

export interface Message<
  Side extends string,
  Tag extends string,
  Payload extends Schema.Top,
  Success extends Schema.Top,
  Failure extends Schema.Top,
> {
  readonly [TypeId]: TypeId;
  readonly side: Side;
  readonly tag: Tag;
  readonly schemas: Schemas;
  /** @internal */
  readonly carrier: Transport.Carrier<Tag, Payload, Success, Failure>;
}

/**
 * Erased `Message`, for constraints. It carries no schema parameters on purpose:
 * the underlying rpc type is invariant in its tag, so a parameterized constraint
 * would reject every concrete message and quietly collapse the derived handler and
 * dispatcher types into index signatures.
 */
export interface Any<Side extends string> {
  readonly [TypeId]: TypeId;
  readonly side: Side;
  readonly tag: string;
  readonly schemas: Schemas;
  /** @internal */
  readonly carrier: Transport.AnyCarrier;
}

/** A schema carries an `ast`; a field record is the bag of fields a struct is built from. */
const asSchema = (payload: Schema.Top | Schema.Struct.Fields | undefined): Schema.Top =>
  payload === undefined
    ? Schema.Void
    : "ast" in payload
      ? (payload as Schema.Top)
      : Schema.Struct(payload);

export const make = <
  Side extends string,
  const Tag extends string,
  Payload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
  Success extends Schema.Top = Schema.Void,
  Failure extends Schema.Top = Schema.Never,
>(
  side: Side,
  tag: Tag,
  options?: {
    readonly payload?: Payload;
    readonly success?: Success;
    readonly failure?: Failure;
  },
): Message<
  Side,
  Tag,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload> : Payload,
  Success,
  Failure
> => ({
  [TypeId]: TypeId,
  side,
  tag,
  // Defaults mirror `Rpc.make`'s: a message that declares nothing reports nothing
  // and cannot fail in a way a caller handles. A payload given as a field record
  // is normalised to the struct it stands for, so what is recorded here is always
  // a schema — the same thing the transport is handed.
  schemas: {
    payload: asSchema(options?.payload),
    success: options?.success ?? Schema.Void,
    failure: options?.failure ?? Schema.Never,
  },
  carrier: Transport.makeCarrier(tag, options) as never,
});

export interface Group<Side extends string, Messages extends Any<string>> {
  readonly [GroupTypeId]: GroupTypeId;
  readonly side: Side;
  /**
   * The tags this group carries, in declaration order. Recorded here rather than
   * read back off the transport, so asking what a module owns never depends on
   * which transport is carrying it.
   */
  readonly tags: ReadonlyArray<string>;
  /** The messages themselves, so their declared contracts stay reachable. */
  readonly messages: ReadonlyArray<Any<Side>>;
  /** @internal */
  readonly group: Transport.GroupCarrier<CarrierOf<Messages>>;
}

/** Erased `Group`, for constraints — same reasoning as `Any`. */
export interface AnyGroup<Side extends string> {
  readonly [GroupTypeId]: GroupTypeId;
  readonly side: Side;
  readonly tags: ReadonlyArray<string>;
  readonly messages: ReadonlyArray<Any<Side>>;
  /** @internal */
  readonly group: Transport.AnyGroupCarrier;
}

export type CarrierOf<M> =
  M extends Message<infer _Side, infer Tag, infer Payload, infer Success, infer Failure>
    ? Transport.Carrier<Tag, Payload, Success, Failure>
    : never;

export const group = <Side extends string, const Messages extends ReadonlyArray<Any<Side>>>(
  side: Side,
  ...messages: Messages
): Group<Side, Messages[number]> =>
  ({
    [GroupTypeId]: GroupTypeId,
    side,
    tags: messages.map((message) => message.tag),
    messages,
    group: Transport.makeGroupCarrier(messages.map((message) => message.carrier)),
  }) as never;

/**
 * Whether a value is a message of the given side. A host needs this to reflect
 * over its own modules and ask whether everything it exports is reachable — a
 * definition nobody put in a group is invisible to any bus.
 */
// Read through `unknown` rather than the branded interface: accessing the brand on
// an already-typed value narrows it to its own literal, and the comparison the
// check is made of would then be flagged as always true.
const brandOf = (u: unknown, key: string): unknown =>
  typeof u === "object" && u !== null ? (u as Record<string, unknown>)[key] : undefined;

export const isMessage = <Side extends string>(side: Side, u: unknown): u is Any<Side> =>
  brandOf(u, TypeId) === TypeId && (u as Any<string>).side === side;

/** The group counterpart of `isMessage`, for the same reflection use. */
export const isGroup = <Side extends string>(side: Side, u: unknown): u is AnyGroup<Side> =>
  brandOf(u, GroupTypeId) === GroupTypeId && (u as AnyGroup<string>).side === side;

export type Handlers<G extends AnyGroup<string>> =
  G extends Group<string, infer Messages> ? Transport.HandlersFrom<CarrierOf<Messages>> : never;

export type HandlerServices<G extends AnyGroup<string>, H> =
  G extends Group<string, infer Messages>
    ? Transport.HandlerServicesFrom<CarrierOf<Messages>, H>
    : never;

declare const RegisteredBrand: unique symbol;

/**
 * What a built handler set provides, and what dispatching demands.
 *
 * Deliberately opaque. The runtime value is the transport's own handler context,
 * but naming that type here would put it in this package's emitted declarations —
 * so a consumer's `.d.ts` would reference the transport even though its source
 * never imports it. This token is bookkeeping: only `handlersOf` produces it and
 * only a bus consumes it.
 */
export interface Registered<G extends AnyGroup<string>> {
  readonly [RegisteredBrand]: G;
}

export const handlersOf = <G extends AnyGroup<string>, H extends Handlers<G>>(
  messageGroup: G,
  handlers: H,
): Layer.Layer<Registered<G>, never, HandlerServices<G, H>> =>
  Transport.registerHandlers(messageGroup.group, handlers) as never;

/**
 * Per-message span-attribute extractors, keyed by tag, passed to the bus rather than
 * attached to a message — so a message stays plain data and cannot lose its attributes
 * by crossing a boundary that does not decode it. Returning `{}` (or omitting a tag) is
 * the safe default: only fields whose author has audited them as non-sensitive should
 * reach a span.
 */
export type SpanAttributes<G extends AnyGroup<string>> =
  G extends Group<string, infer Messages>
    ? {
        readonly [M in Messages as M["tag"]]?: (payload: PayloadOf<M>) => Record<string, unknown>;
      }
    : never;

/** Erased view of the above, for a bus's by-tag lookup. */
export type SpanAttributesErased = Readonly<
  Record<string, (payload: never) => Record<string, unknown>>
>;

/** The dispatch surface a built bus exposes: one method per message tag. */
export type Dispatcher<G extends AnyGroup<string>> =
  G extends Group<string, infer Messages>
    ? {
        readonly [M in Messages as M["tag"]]: (
          payload: PayloadOf<M>,
        ) => Effect.Effect<SuccessOf<M>, FailureOf<M>, never>;
      }
    : never;

/** The decoded payload a message carries — what a handler receives and a dispatch takes. */
export type PayloadOf<M> =
  M extends Message<infer _S, infer _T, infer Payload, infer _Su, infer _F>
    ? Payload["Type"]
    : never;

/** The value a message's handler resolves with. */
export type SuccessOf<M> =
  M extends Message<infer _S, infer _T, infer _P, infer Success, infer _F>
    ? Success["Type"]
    : never;

/** The errors a message's handler may fail with. */
export type FailureOf<M> =
  M extends Message<infer _S, infer _T, infer _P, infer _Su, infer Failure>
    ? Failure["Type"]
    : never;

/**
 * Builds a group's dispatch surface. The transport works against the erased group;
 * the tag-accurate types are recovered on the way out via `Dispatcher<G>`, so the
 * widening is not observable to a caller.
 */
export const dispatcher = <G extends AnyGroup<string>>(
  messageGroup: G,
  middleware: ReadonlyArray<Middleware>,
): Effect.Effect<Dispatcher<G>, never, Scope.Scope | Registered<G>> =>
  Transport.makeDispatcher(
    messageGroup.group,
    messageGroup.tags,
    messageGroup.side as "command" | "query",
    middleware,
  ) as never;
