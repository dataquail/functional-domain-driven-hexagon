import { type Event } from "@effect-server-utils/cqrs";
import { AfterCommitTransport } from "@effect-server-utils/unit-of-work";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DomainEventQueue } from "@/globals/infrastructure/events/domain-event-queue.js";

export const OutboxTransportLive: Layer.Layer<
  AfterCommitTransport,
  never,
  Database.Database | DomainEventQueue
> = Layer.effect(
  AfterCommitTransport,
  Effect.gen(function* () {
    const sql = yield* Database.Database;
    const queue = yield* DomainEventQueue;

    const enqueue = (envelopes: ReadonlyArray<Event.Envelope>) =>
      sql`
        INSERT INTO platform.event_outbox ${sql.insert(
          envelopes.map((envelope) => ({
            event_id: envelope.eventId,
            handler: envelope.handler,
            tag: envelope.tag,
            payload: Database.jsonb(envelope.payload),
            occurred_at: envelope.occurredAt,
          })),
        )}
      `.pipe(Database.exec, Effect.orDie);

    const recordAttempt = (envelope: Event.Envelope, relayed: boolean) =>
      sql`
        UPDATE platform.event_outbox
        SET attempts = attempts + 1,
            last_attempted_at = now(),
            relayed_at = ${relayed ? sql`now()` : sql`NULL`}
        WHERE event_id = ${envelope.eventId} AND handler = ${envelope.handler}
      `.pipe(Database.exec, Effect.orDie);

    const relay = (envelope: Event.Envelope) =>
      queue.send(envelope).pipe(
        Effect.matchEffect({
          onSuccess: () => recordAttempt(envelope, true),
          onFailure: () => recordAttempt(envelope, false),
        }),
      );

    return AfterCommitTransport.of({
      enqueue,
      flush: (envelopes) => Effect.forEach(envelopes, relay, { discard: true }),
    });
  }),
);
