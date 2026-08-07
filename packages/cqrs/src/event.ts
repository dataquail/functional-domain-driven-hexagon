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

/**
 * A declared event: the tag a bus routes on, and the schema of what it carries.
 *
 * Deliberately *holds* its schema rather than being one. An event that was itself
 * a schema could be annotated, made optional, or piped — and each of those returns
 * a new schema carrying neither the tag nor the brand, so it would quietly stop
 * being an event with nothing to say so. Holding it means the only way to derive
 * is to name `.schema`, which is honest about what comes back.
 *
 * `make` and `Type` are forwarded because constructing an event and naming the
 * value it carries are what nearly every call site does. `.schema` is for the
 * rare one that genuinely wants a schema.
 */
export interface Event<Tag extends string, Fields extends Schema.Struct.Fields> {
  readonly [TypeId]: TypeId;
  readonly tag: Tag;
  readonly schema: Schema.TaggedStruct<Tag, Fields>;
  readonly make: Schema.TaggedStruct<Tag, Fields>["make"];
  /** Phantom, mirroring a schema's own: the decoded value this event carries. */
  readonly Type: Schema.TaggedStruct<Tag, Fields>["Type"];
}

/**
 * Erased `Event`, for constraints. Structural rather than the schema-shaped
 * intersection it replaced, so an arbitrary struct schema no longer satisfies it.
 */
export interface Any {
  readonly [TypeId]: TypeId;
  readonly tag: string;
  readonly schema: Schema.Top;
  readonly Type: unknown;
}

/** The value an event carries — what a subscriber receives and a saga streams. */
export type Type<E> = E extends { readonly Type: infer T } ? T : never;

/**
 * Declares an event. The third message kind alongside `Command.make` and
 * `Query.make`, and the one that fans out: many handlers may answer one event,
 * where a command and a query each have exactly one.
 *
 * An event is plain data rather than a class instance, so its in-memory shape
 * and its serialized shape are the same. That is what lets the same definition
 * describe an event dispatched in-process today and one read back off a durable
 * log later, with no "did I remember to decode this?" question in between.
 */
export const make = <const Tag extends string, Fields extends Schema.Struct.Fields>(
  tag: Tag,
  fields: Fields,
): Event<Tag, Fields> => {
  const schema = Schema.TaggedStruct(tag, fields);
  // `Type` is a phantom with no runtime counterpart, the same way a schema's own
  // is, so the assembled object cannot satisfy the interface without this.
  return {
    [TypeId]: TypeId,
    tag,
    schema,
    make: (input, options) => schema.make(input, options),
  } as Event<Tag, Fields>;
};

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
