import { type Event, type EventBus } from "@effect-server-utils/cqrs";
import {
  deliverOnce,
  type DeliveryLedger,
  type UnitOfWork,
} from "@effect-server-utils/unit-of-work";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import {
  DomainEventNotDelivered,
  DomainEventQueue,
} from "@/globals/infrastructure/events/domain-event-queue.js";

type Deliver = (envelope: Event.Envelope) => Effect.Effect<Exit.Exit<unknown, unknown>>;

export class InProcessDomainEventConsumer extends Context.Service<
  InProcessDomainEventConsumer,
  { readonly attach: (deliver: Deliver) => Effect.Effect<void> }
>()("InProcessDomainEventConsumer") {}

// Attached after build: delivering needs the unit of work, which needs this queue.
export const InProcessDomainEventQueueLive: Layer.Layer<
  DomainEventQueue | InProcessDomainEventConsumer
> = Layer.effectContext(
  Effect.gen(function* () {
    const consumer = yield* Ref.make<Option.Option<Deliver>>(Option.none());

    const send = Effect.fn("InProcessDomainEventQueue.send")(function* (envelope: Event.Envelope) {
      const deliver = yield* Ref.get(consumer);
      if (Option.isNone(deliver)) {
        return yield* Effect.die(new Error("InProcessDomainEventQueue: no consumer attached"));
      }
      const exit = yield* deliver.value(envelope);
      if (Exit.isFailure(exit)) {
        return yield* new DomainEventNotDelivered({
          eventId: envelope.eventId,
          handler: envelope.handler,
        });
      }
    });

    return Context.make(DomainEventQueue, DomainEventQueue.of({ send })).pipe(
      Context.add(InProcessDomainEventConsumer, {
        attach: (deliver) => Ref.set(consumer, Option.some(deliver)),
      }),
    );
  }),
);

export const InProcessDomainEventDeliveryLive: Layer.Layer<
  never,
  never,
  InProcessDomainEventConsumer | EventBus | UnitOfWork | DeliveryLedger
> = Layer.effectDiscard(
  Effect.gen(function* () {
    const consumer = yield* InProcessDomainEventConsumer;
    const context = yield* Effect.context<EventBus | UnitOfWork | DeliveryLedger>();
    yield* consumer.attach((envelope) => deliverOnce(envelope).pipe(Effect.provide(context)));
  }),
);
