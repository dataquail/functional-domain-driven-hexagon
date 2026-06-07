import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event-repository.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

export const WebhookEventRepositoryLive = Layer.effect(
  WebhookEventRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    // `INSERT … ON CONFLICT DO NOTHING RETURNING stripe_event_id`:
    // returns one row on first insert, zero rows on a duplicate.
    // We translate the row-count to a boolean — `true` means "this
    // delivery is new, fan out to commands"; `false` means "we've
    // already processed this, return 200 and stop."
    const recordIfNew = db.makeQuery((execute, stripeEventId: string) =>
      execute((client) =>
        client.any(sql.unsafe`
          INSERT INTO billing.webhook_events (stripe_event_id)
          VALUES (${stripeEventId})
          ON CONFLICT (stripe_event_id) DO NOTHING
          RETURNING stripe_event_id
        `),
      ).pipe(
        Effect.map((rows) => rows.length > 0),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("WebhookEventRepository.recordIfNew"),
      ),
    );

    return WebhookEventRepository.of({ recordIfNew });
  }),
);
