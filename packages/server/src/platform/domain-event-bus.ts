import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import type * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import { type AnyDomainEventSchema, type DomainEvent } from "./domain-event.js";

export { DomainEvent } from "./domain-event.js";

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
