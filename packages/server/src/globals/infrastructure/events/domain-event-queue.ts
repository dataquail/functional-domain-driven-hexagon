import { type Event } from "@effect-server-utils/cqrs";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

// Answers with the envelopes it could not hand on; their outbox rows stay for the sweeper.
export type DomainEventQueueService = {
  readonly send: (
    envelopes: ReadonlyArray<Event.Envelope>,
  ) => Effect.Effect<ReadonlyArray<Event.Envelope>>;
};

export class DomainEventQueue extends Context.Service<DomainEventQueue, DomainEventQueueService>()(
  "DomainEventQueue",
) {}
