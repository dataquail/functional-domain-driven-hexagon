import { type Event } from "@effect-server-utils/cqrs";
import { AfterCommitTransport } from "@effect-server-utils/unit-of-work";
import { Database, RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

// Past this, a row is left for an operator rather than retried forever.
const MAX_ATTEMPTS = 10;
const BATCH_SIZE = 100;

export const toEnvelope = (row: RowSchemas.EventOutboxRow): Event.Envelope => ({
  eventId: row.event_id,
  handler: row.handler,
  tag: row.tag,
  payload: row.payload,
  occurredAt: DateTime.formatIso(row.occurred_at),
});

// Stamping `last_attempted_at` as the claim keeps a concurrent sweep off this batch.
export const sweepOutbox = (
  staleAfter: Duration.Duration = Duration.minutes(1),
): Effect.Effect<number, never, Database.Database | AfterCommitTransport> =>
  Effect.gen(function* () {
    const sql = yield* Database.Database;
    const transport = yield* AfterCommitTransport;
    const stale = `${Duration.toMillis(staleAfter)} milliseconds`;

    const claimed = yield* sql`
      UPDATE platform.event_outbox
      SET last_attempted_at = now()
      WHERE (event_id, handler) IN (
        SELECT event_id, handler FROM platform.event_outbox
        WHERE relayed_at IS NULL
          AND attempts < ${MAX_ATTEMPTS}
          AND occurred_at <= now() - ${stale}::interval
          AND (last_attempted_at IS NULL OR last_attempted_at <= now() - ${stale}::interval)
        ORDER BY occurred_at
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `.pipe(Database.rows(RowSchemas.EventOutboxRow), Effect.orDie);

    yield* transport.flush(claimed.map(toEnvelope));
    return claimed.length;
  }).pipe(Effect.withSpan("outbox.sweep"));

export const OutboxSweeperLive: Layer.Layer<
  never,
  never,
  Database.Database | AfterCommitTransport
> = Layer.effectDiscard(
  Effect.forkScoped(
    sweepOutbox().pipe(
      Effect.catchCause((cause) => Effect.logError("[outbox.sweep] iteration failed", cause)),
      Effect.delay(Duration.minutes(1)),
      Effect.forever,
    ),
  ),
);
