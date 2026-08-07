import * as Schema from "effect/Schema";

import type { SpanAttributeValue } from "./middleware.js";

/**
 * The base an event satisfies: a tag the bus routes on. Deliberately minimal —
 * a consumer's domain layer references this type, so anything more would be a
 * dependency it did not ask for.
 */
export interface Base {
  readonly _tag: string;
}

export type { SpanAttributeValue };

export type SpanAttributesExtractor<A> = (value: A) => Record<string, SpanAttributeValue>;

export type TypeId = "~@org/cqrs/Event";
const TypeId: TypeId = "~@org/cqrs/Event";

export type Brand = { readonly [TypeId]: TypeId };

/**
 * Erased event schema, for constraints. Carries the brand and the static tag
 * that `subscribe` registers under, so an arbitrary struct schema cannot be
 * passed where an event is expected.
 */
export type Any = Schema.Top & Brand & { readonly tag: string };

/**
 * Declares an event. The third message kind alongside `Command.make` and
 * `Query.make`, and the one that fans out: many handlers may answer one event,
 * where a command and a query each have exactly one.
 *
 * An event is plain data rather than a class instance, so its in-memory shape
 * and its serialized shape are the same. That is what lets the same definition
 * describe an event dispatched in-process today and one read back off a durable
 * log later, with no "did I remember to decode this?" question in between.
 *
 * The identity is carried on the schema itself rather than in a wrapper, so an
 * event reads as the schema it is at every call site. The cost is that a schema
 * *derived* from one — annotated, made optional, piped — is a new object that
 * carries neither the brand nor the tag, and is no longer an event to `is`.
 * Derive from the fields, not from the event.
 */
export const make = <Tag extends string, Fields extends Schema.Struct.Fields>(
  tag: Tag,
  fields: Fields,
): Schema.TaggedStruct<Tag, Fields> & Brand & { readonly tag: Tag } =>
  Object.assign(Schema.TaggedStruct(tag, fields), {
    tag,
    [TypeId]: TypeId,
  });

/**
 * Per-event span-attribute extractors, keyed by tag — a module declares its own
 * and they are merged where the bus is built, the same way dispatch surfaces are.
 *
 * `never` in argument position is the contravariance trick the command and query
 * registries also use: it lets the merged map hold extractors typed against
 * their own concrete event, which a `DomainEvent`-typed argument would reject.
 * Routing by tag before invocation is what makes that safe.
 */
export type SpanAttributes = Readonly<
  Record<string, (event: never) => Record<string, SpanAttributeValue>>
>;

/** Type-checked identity, so a module's contribution is validated where it is written. */
export const spanAttributes = <const M extends SpanAttributes>(map: M): M => map;

/**
 * Whether a value is an event definition — the counterpart of `Command.is`, and
 * what lets a host reflect over its own barrels to check every event it publishes.
 */
export const is = (u: unknown): u is Any =>
  typeof u === "object" &&
  u !== null &&
  (u as { readonly [TypeId]?: unknown })[TypeId] === TypeId &&
  typeof (u as { readonly tag?: unknown }).tag === "string";
