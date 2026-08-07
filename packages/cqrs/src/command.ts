import type * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import type * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";

import * as Message from "./internal/message.js";
import * as Middleware from "./middleware.js";

/**
 * A write-side message: a tag, the payload that names it, and the success and
 * failure it declares. Defining a command is the only thing a feature module has to
 * do to make it dispatchable.
 *
 * The transport that carries a command is this package's business. Nothing about it
 * appears here, and no consumer imports it.
 */
export type Command<
  Tag extends string,
  Payload extends Schema.Top,
  Success extends Schema.Top,
  Failure extends Schema.Top,
> = Message.Message<Side, Tag, Payload, Success, Failure>;

/** Distinguishes the write side from the read side in types. */
export type Side = "command";

/** Erased `Command`, for constraints. */
export type Any = Message.Any<Side>;

/**
 * Declares a command. `payload` accepts a field record or a schema; `success` and
 * `failure` default to void and never, matching a command that reports nothing and
 * cannot fail in a way the caller handles.
 *
 * Declaring these as schemas rather than bare types is what keeps a command
 * portable: the same definition describes an in-process dispatch today and a
 * serialized one if the module is ever extracted.
 */
export const make = <
  const Tag extends string,
  Payload extends Schema.Top | Schema.Struct.Fields = Schema.Void,
  Success extends Schema.Top = Schema.Void,
  Failure extends Schema.Top = Schema.Never,
>(
  tag: Tag,
  options?: {
    readonly payload?: Payload;
    readonly success?: Success;
    readonly failure?: Failure;
  },
): Command<
  Tag,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload> : Payload,
  Success,
  Failure
> => Message.make("command", tag, options);

/**
 * A module's slice of the write-side surface. Grouping is what lets a module hand
 * the composition root one value to register, and what `handlersOf` type-checks a
 * handler set against.
 */
export type Group<Commands extends Any> = Message.Group<Side, Commands>;

/** Erased `Group`, for constraints. */
export type AnyGroup = Message.AnyGroup<Side>;

/**
 * The payload a command carries. A handler names its input with this rather than
 * re-declaring the shape, so the schema stays the single definition.
 */
export type Payload<M extends Any> = Message.PayloadOf<M>;

/** The value a command's handler resolves with. */
export type Success<M extends Any> = Message.SuccessOf<M>;

/** The errors a command's handler may fail with. */
export type Failure<M extends Any> = Message.FailureOf<M>;

export const group = <const Commands extends ReadonlyArray<Any>>(
  ...commands: Commands
): Group<Commands[number]> => Message.group("command", ...commands);

/**
 * The handler set a group demands: one function per tag, taking that command's
 * payload and returning its declared success and failure. Whatever services the
 * functions need are inferred and become the Layer's requirements.
 */
export type Handlers<G extends AnyGroup> = Message.Handlers<G>;

/** The services a group's handlers collectively require. */
export type HandlerServices<G extends AnyGroup, H> = Message.HandlerServices<G, H>;

/** What a built handler set provides, and what dispatching a command demands. */
export type Registered<G extends AnyGroup> = Message.Registered<G>;

/** Per-command span-attribute extractors, keyed by tag. */
export type SpanAttributes<G extends AnyGroup> = Message.SpanAttributes<G>;

/** The dispatch surface a built command bus exposes. */
export type Dispatcher<G extends AnyGroup> = Message.Dispatcher<G>;

/**
 * Implements a group's handlers. The resulting Layer carries the handlers'
 * requirements, which is what moves the burden of satisfying them from every
 * dispatch site to the one place that composes the application.
 */
export const handlersOf = <G extends AnyGroup, H extends Handlers<G>>(
  commandGroup: G,
  handlers: H,
): Layer.Layer<Registered<G>, never, HandlerServices<G, H>> =>
  Message.handlersOf(commandGroup, handlers);

/**
 * Builds a group's dispatch surface: one method per command tag, each taking that
 * command's payload. This is what a module publishes so a caller can reach the
 * commands that module owns without naming an application-wide bus.
 *
 * A dispatched command's requirement channel is empty — the handlers' services were
 * discharged by `handlersOf` where the group was registered. Handlers observe the
 * dispatching fiber's context, which is what lets a command dispatched from inside a
 * caller's transaction join it rather than opening its own.
 *
 * Each dispatch opens one span, `command.<tag>`, nested under whatever span the caller
 * is already in and annotated from the tag's registered extractor.
 */
export const dispatcher = <G extends AnyGroup>(
  commandGroup: G,
  options: {
    readonly spanAttributes?: SpanAttributes<G>;
    readonly middleware?: ReadonlyArray<Middleware.Middleware>;
  } = {},
): Effect.Effect<Dispatcher<G>, never, Scope.Scope | Registered<G>> =>
  Message.dispatcher(commandGroup, [
    // Outermost, so a caller's middleware runs inside the dispatch span and its
    // work is attributed there rather than to whatever ran before it.
    Middleware.span({ spanPrefix: "command", attributes: options.spanAttributes }),
    ...(options.middleware ?? []),
  ]);

/**
 * Whether a value is a command definition. Lets a host reflect over its own
 * module barrels and check that every message it publishes is reachable — the
 * one completeness question a bus cannot answer, because a definition that was
 * never put in a group never reaches it.
 */
export const is = (u: unknown): u is Any => Message.isMessage("command", u);

/** Whether a value is a command group — the group counterpart of `is`. */
export const isGroup = (u: unknown): u is AnyGroup => Message.isGroup("command", u);
