import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

export interface DomainEvent {
  readonly _tag: string;
}

export interface DomainEventBusShape {
  readonly publishAll: (events: ReadonlyArray<DomainEvent>) => Effect.Effect<void>;
  readonly subscribe: <T extends string>(
    tag: T,
    handler: (event: Extract<DomainEvent, { _tag: T }>) => Effect.Effect<void>,
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

    const subscribe = <T extends string>(
      tag: T,
      handler: (event: Extract<DomainEvent, { _tag: T }>) => Effect.Effect<void>,
    ) =>
      Effect.gen(function* () {
        const subscription = yield* PubSub.subscribe(pubsub);
        yield* Stream.fromQueue(subscription).pipe(
          Stream.filter((e): e is Extract<DomainEvent, { _tag: T }> => e._tag === tag),
          Stream.runForEach(handler),
          Effect.forkScoped,
        );
      });

    return { publishAll, subscribe };
  }),
);
