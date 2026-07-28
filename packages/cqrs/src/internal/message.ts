import type * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import type * as Schema from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";

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
  /** @internal */
  readonly rpc: Rpc.Rpc<Tag, Payload, Success, Failure>;
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
  /** @internal */
  readonly rpc: Rpc.Any;
}

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
  rpc: Rpc.make(tag, {
    ...(options?.payload !== undefined ? { payload: options.payload } : {}),
    ...(options?.success !== undefined ? { success: options.success } : {}),
    ...(options?.failure !== undefined ? { error: options.failure } : {}),
  }),
});

export interface Group<Side extends string, Messages extends Any<string>> {
  readonly [GroupTypeId]: GroupTypeId;
  readonly side: Side;
  /** @internal */
  readonly group: RpcGroup.RpcGroup<RpcOf<Messages>>;
}

/** Erased `Group`, for constraints — same reasoning as `Any`. */
export interface AnyGroup<Side extends string> {
  readonly [GroupTypeId]: GroupTypeId;
  readonly side: Side;
  /** @internal */
  readonly group: RpcGroup.Any;
}

export type RpcOf<M> =
  M extends Message<infer _Side, infer Tag, infer Payload, infer Success, infer Failure>
    ? Rpc.Rpc<Tag, Payload, Success, Failure>
    : never;

export const group = <Side extends string, const Messages extends ReadonlyArray<Any<Side>>>(
  side: Side,
  ...messages: Messages
): Group<Side, Messages[number]> =>
  ({
    [GroupTypeId]: GroupTypeId,
    side,
    group: RpcGroup.make(...messages.map((message) => message.rpc)),
  }) as never;

export type Handlers<G extends AnyGroup<string>> =
  G extends Group<string, infer Messages> ? RpcGroup.HandlersFrom<RpcOf<Messages>> : never;

export type HandlerServices<G extends AnyGroup<string>, H> =
  G extends Group<string, infer Messages> ? RpcGroup.HandlersServices<RpcOf<Messages>, H> : never;

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
  rpcGroupOf(messageGroup).toLayer(handlers as never) as never;

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

// A bus works against the erased group; the tag-accurate types are recovered on the
// way out via `Dispatcher<G>`, so this widening is not observable to a caller.
export const rpcGroupOf = (messageGroup: AnyGroup<string>): RpcGroup.RpcGroup<Rpc.Any> =>
  messageGroup.group as unknown as RpcGroup.RpcGroup<Rpc.Any>;
