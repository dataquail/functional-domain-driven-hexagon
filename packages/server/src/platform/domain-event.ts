import * as Schema from "effect/Schema";

export interface DomainEvent {
  readonly _tag: string;
}

const DOMAIN_EVENT_BRAND = "@platform/DomainEvent";

export type DomainEventBrand = { readonly __brand: typeof DOMAIN_EVENT_BRAND };

export type AnyDomainEventSchema = Schema.Schema.Any & DomainEventBrand & { readonly tag: string };

// `DomainEvent` returns a `Schema.TaggedStruct` carrying the brand and a
// static `tag` that `DomainEventBus.subscribe` and the dispatch loop rely
// on. Events are kept as plain data (not class instances) so the wire
// format and the in-memory format are the same shape — important once
// events flow through an outbox table or a message queue, where the
// "did I remember to decode this?" question disappears entirely.
//
// Span-attribute extraction is a sibling concern (see
// `eventSpanAttributes` in `domain-event-bus.ts` and the per-event
// `<name>SpanAttributes` exports). Composition at registration time, not
// inheritance.
export const DomainEvent = <Tag extends string, Fields extends Schema.Struct.Fields>(
  tag: Tag,
  fields: Fields,
): Schema.TaggedStruct<Tag, Fields> & DomainEventBrand & { readonly tag: Tag } => {
  const schema = Schema.TaggedStruct(tag, fields);
  return Object.assign(schema, {
    tag,
    __brand: DOMAIN_EVENT_BRAND,
  }) as Schema.TaggedStruct<Tag, Fields> & DomainEventBrand & { readonly tag: Tag };
};
