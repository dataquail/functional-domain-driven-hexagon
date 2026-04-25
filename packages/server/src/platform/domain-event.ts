import * as Schema from "effect/Schema";

export interface DomainEvent {
  readonly _tag: string;
}

const DOMAIN_EVENT_BRAND = "@platform/DomainEvent";

export type DomainEventBrand = { readonly __brand: typeof DOMAIN_EVENT_BRAND };

export type AnyDomainEventSchema = Schema.Schema.Any & DomainEventBrand & { readonly tag: string };

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
