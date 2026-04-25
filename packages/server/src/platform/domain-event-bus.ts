import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import type * as Schema from "effect/Schema";
import { type AnyDomainEventSchema, type DomainEvent } from "./domain-event.js";

export { DomainEvent } from "./domain-event.js";

// Synchronous in-fiber dispatch. Handlers run in the publisher's fiber, in
// registration order, and inherit the publisher's context — including
// `TransactionContext` from `TransactionRunner.run`. A handler failure
// propagates out of `dispatch`, which means the surrounding transaction
// rolls back. This trades async fan-out for immediate consistency between
// aggregates that participate in the same unit of work. For genuinely
// eventually-consistent integration events, build a separate outbox-backed
// mechanism — do not extend this bus.
type Handler = (event: DomainEvent) => Effect.Effect<void>;

export interface DomainEventBusShape {
  readonly dispatch: (events: ReadonlyArray<DomainEvent>) => Effect.Effect<void>;
  readonly subscribe: <S extends AnyDomainEventSchema>(
    event: S,
    handler: (event: Schema.Schema.Type<S>) => Effect.Effect<void>,
  ) => Effect.Effect<void>;
}

export class DomainEventBus extends Context.Tag("DomainEventBus")<
  DomainEventBus,
  DomainEventBusShape
>() {}

export const DomainEventBusLive: Layer.Layer<DomainEventBus> = Layer.effect(
  DomainEventBus,
  Effect.gen(function* () {
    const handlers = yield* Ref.make<ReadonlyMap<string, ReadonlyArray<Handler>>>(new Map());

    const subscribe: DomainEventBusShape["subscribe"] = (event, handler) =>
      Ref.update(handlers, (m) => {
        const existing = m.get(event.tag) ?? [];
        const next = new Map(m);
        next.set(event.tag, [...existing, handler as Handler]);
        return next;
      });

    const dispatch: DomainEventBusShape["dispatch"] = (events) =>
      Effect.gen(function* () {
        const map = yield* Ref.get(handlers);
        for (const event of events) {
          const list = map.get(event._tag) ?? [];
          for (const handler of list) {
            yield* handler(event);
          }
        }
      });

    return DomainEventBus.of({ dispatch, subscribe });
  }),
);
