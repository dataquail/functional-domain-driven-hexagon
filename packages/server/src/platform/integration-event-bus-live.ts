import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type DomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { PostCommitBuffer } from "@/platform/ddd/contracts/post-commit-buffer.js";
import {
  IntegrationEventBus,
  type IntegrationEventBusShape,
} from "@/platform/ddd/ports/integration-event-bus.js";

type Handler = (event: DomainEvent) => Effect.Effect<void>;

/**
 * Builds the live `IntegrationEventBus` layer. Subscribers register into a
 * `Ref` handler map keyed by `event._tag` (mirroring `makeDomainEventBusLive`);
 * `dispatch` appends to the ambient `PostCommitBuffer` rather than running
 * them. The unit of work drains the buffer post-commit via `handlersFor`.
 *
 * No dependency on `UnitOfWork` — the buffer is the only seam between the two,
 * and it flows in through context. That keeps the dependency arrow one-way
 * (`UnitOfWorkLive` → `IntegrationEventBus`, never back).
 */
export const makeIntegrationEventBusLive = (): Layer.Layer<IntegrationEventBus> =>
  Layer.effect(
    IntegrationEventBus,
    Effect.gen(function* () {
      const handlers = yield* Ref.make<ReadonlyMap<string, ReadonlyArray<Handler>>>(new Map());

      const subscribe: IntegrationEventBusShape["subscribe"] = (event, handler) =>
        Ref.update(handlers, (m) => {
          const existing = m.get(event.tag) ?? [];
          const next = new Map(m);
          next.set(event.tag, [...existing, handler as Handler]);
          return next;
        });

      const dispatch: IntegrationEventBusShape["dispatch"] = (events) =>
        Effect.serviceOption(PostCommitBuffer).pipe(
          Effect.flatMap(
            Option.match({
              // Fail fast: an integration event dispatched outside a unit of
              // work would be silently dropped (nothing drains it). That almost
              // always means a missing `withUnitOfWork` — surface it as a defect.
              onNone: () =>
                Effect.die(
                  new Error(
                    "IntegrationEventBus.dispatch requires a unit of work: no PostCommitBuffer in scope (did you forget withUnitOfWork?)",
                  ),
                ),
              onSome: (buffer) => Ref.update(buffer, (prev) => [...prev, ...events]),
            }),
          ),
        );

      const handlersFor: IntegrationEventBusShape["handlersFor"] = (tag) =>
        Ref.get(handlers).pipe(Effect.map((m) => m.get(tag) ?? []));

      return IntegrationEventBus.of({ dispatch, subscribe, handlersFor });
    }),
  );
