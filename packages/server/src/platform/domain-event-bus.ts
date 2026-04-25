import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

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

export interface DomainEventBusShape {
  readonly publishAll: (events: ReadonlyArray<DomainEvent>) => Effect.Effect<void>;
  readonly subscribe: <S extends AnyDomainEventSchema>(
    event: S,
    handler: (event: Schema.Schema.Type<S>) => Effect.Effect<void>,
  ) => Effect.Effect<void, never, Scope.Scope>;
}

export class DomainEventBus extends Context.Tag("DomainEventBus")<
  DomainEventBus,
  DomainEventBusShape
>() {}

export const DomainEventBusLive: Layer.Layer<DomainEventBus> = Layer.scoped(
  DomainEventBus,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<DomainEvent>();

    const publishAll = (events: ReadonlyArray<DomainEvent>) =>
      Effect.forEach(events, (event) => PubSub.publish(pubsub, event), { discard: true });

    const subscribe: DomainEventBusShape["subscribe"] = (event, handler) =>
      Effect.gen(function* () {
        const subscription = yield* PubSub.subscribe(pubsub);
        yield* Stream.fromQueue(subscription).pipe(
          Stream.filter((e) => e._tag === event.tag),
          Stream.runForEach(handler as (event: DomainEvent) => Effect.Effect<void>),
          Effect.forkScoped,
        );
      });

    return { publishAll, subscribe };
  }),
);
