import { type Event } from "@effect-server-utils/cqrs";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export class DomainEventNotDelivered extends Schema.TaggedError<DomainEventNotDelivered>()(
  "DomainEventNotDelivered",
  { eventId: Schema.String, handler: Schema.String },
) {}

// A failed send leaves the envelope's outbox row for the sweeper.
export type DomainEventQueueShape = {
  readonly send: (envelope: Event.Envelope) => Effect.Effect<void, DomainEventNotDelivered>;
};

export class DomainEventQueue extends Context.Service<DomainEventQueue, DomainEventQueueShape>()(
  "DomainEventQueue",
) {}
