import { type Event } from "@effect-server-utils/cqrs";
import { AfterCommitTransport } from "@effect-server-utils/unit-of-work";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DomainEventQueue } from "@/globals/infrastructure/events/domain-event-queue.ts";

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

    const relayedAt = (relayed: boolean) => {
      if (relayed) return sql`now()`;

      return sql`NULL`;
    };

    const recordAttempt = (envelope: Event.Envelope, relayed: boolean) =>
      sql`
        UPDATE platform.event_outbox
        SET attempts = attempts + 1,
            last_attempted_at = now(),
            relayed_at = ${relayedAt(relayed)}
        WHERE event_id = ${envelope.eventId} AND handler = ${envelope.handler}
      `.pipe(Database.exec, Effect.orDie);

    const relay = (envelopes: ReadonlyArray<Event.Envelope>) =>
      Effect.gen(function* () {
        const undelivered = new Set(yield* queue.send(envelopes));
        yield* Effect.forEach(
          envelopes,
          (envelope) => recordAttempt(envelope, !undelivered.has(envelope)),
          { discard: true },
        );
      });

    return AfterCommitTransport.of({
      enqueue,
      flush: relay,
    });
  }),
);
