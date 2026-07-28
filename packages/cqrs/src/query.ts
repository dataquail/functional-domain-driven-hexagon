import type * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import type * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";

import * as Bus from "./internal/bus.js";
import * as Message from "./internal/message.js";

/**
 * A read-side message: a tag, the payload that names it, and the projection it
 * returns. A query answers a question and changes nothing, so a module publishing
 * one is publishing a read model, not a mutation.
 *
 * The transport that carries a query is this package's business. Nothing about it
 * appears here, and no consumer imports it.
 */
export type Query<
  Tag extends string,
  Payload extends Schema.Top,
  Success extends Schema.Top,
  Failure extends Schema.Top,
> = Message.Message<Side, Tag, Payload, Success, Failure>;

/** Distinguishes the read side from the write side in types. */
export type Side = "query";

/** Erased `Query`, for constraints. */
export type Any = Message.Any<Side>;

/**
 * Declares a query. `success` is the projection returned — a query that declares
 * nothing to return is almost certainly a command.
 *
 * Declaring the projection as a schema rather than a bare type is what keeps a
 * query portable, and it forces the read model to be written down: a bare type
 * alias describes a shape, a schema describes a contract.
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
): Query<
  Tag,
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload> : Payload,
  Success,
  Failure
> => Message.make("query", tag, options);

/**
 * A module's slice of the read-side surface. A group of queries cannot stand in for
 * a group of commands anywhere — the two sides are distinct types, which is the
 * CQRS separation the buses rely on rather than merely document.
 */
export type Group<Queries extends Any> = Message.Group<Side, Queries>;

/** Erased `Group`, for constraints. */
export type AnyGroup = Message.AnyGroup<Side>;

/**
 * The payload a query carries. A handler names its input with this rather than
 * re-declaring the shape, so the schema stays the single definition.
 */
export type Payload<M extends Any> = Message.PayloadOf<M>;

/** The value a query's handler resolves with. */
export type Success<M extends Any> = Message.SuccessOf<M>;

/** The errors a query's handler may fail with. */
export type Failure<M extends Any> = Message.FailureOf<M>;

export const group = <const Queries extends ReadonlyArray<Any>>(
  ...queries: Queries
): Group<Queries[number]> => Message.group("query", ...queries);

/**
 * The handler set a group demands: one function per tag, taking that query's payload
 * and returning its projection. Whatever services the functions need are inferred
 * and become the Layer's requirements.
 */
export type Handlers<G extends AnyGroup> = Message.Handlers<G>;

/** The services a group's handlers collectively require. */
export type HandlerServices<G extends AnyGroup, H> = Message.HandlerServices<G, H>;

/** What a built handler set provides, and what dispatching a query demands. */
export type Registered<G extends AnyGroup> = Message.Registered<G>;

/** Per-query span-attribute extractors, keyed by tag. */
export type SpanAttributes<G extends AnyGroup> = Message.SpanAttributes<G>;

/** The dispatch surface a built query bus exposes. */
export type Dispatcher<G extends AnyGroup> = Message.Dispatcher<G>;

/**
 * Implements a group's handlers. The resulting Layer carries the handlers'
 * requirements, which is what moves the burden of satisfying them from every
 * dispatch site to the one place that composes the application.
 */
export const handlersOf = <G extends AnyGroup, H extends Handlers<G>>(
  queryGroup: G,
  handlers: H,
): Layer.Layer<Registered<G>, never, HandlerServices<G, H>> =>
  Message.handlersOf(queryGroup, handlers);

/**
 * Builds a group's dispatch surface: one method per query tag, each taking that
 * query's payload. This is what a module publishes so a caller can ask the questions
 * that module answers without naming an application-wide bus.
 *
 * A dispatched query's requirement channel is empty — the handlers' services were
 * discharged by `handlersOf` where the group was registered. Handlers observe the
 * dispatching fiber's context, so a query resolved inside a caller's transaction reads
 * through that transaction and sees its uncommitted writes. That matters: an
 * authorization check resolved during a mutation must not read a stale view.
 *
 * Each dispatch opens one span, `query.<tag>`, nested under whatever span the caller is
 * already in and annotated from the tag's registered extractor.
 */
export const dispatcher = <G extends AnyGroup>(
  queryGroup: G,
  options: { readonly spanAttributes?: SpanAttributes<G> } = {},
): Effect.Effect<Dispatcher<G>, never, Scope.Scope | Registered<G>> =>
  Bus.make(queryGroup, "query", (options.spanAttributes ?? {}) as never);
