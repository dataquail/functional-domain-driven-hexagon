import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event-repository.js";
import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event-errors.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import * as WebhookEventMapper from "./webhook-event-mapper.js";

export const WebhookEventRepositoryLive = Layer.effect(
  WebhookEventRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    // Race-free claim: Postgres' unique-key violation IS the
    // idempotency signal. The endpoint catches
    // `WebhookEventAlreadyRecorded` to short-circuit duplicate
    // deliveries — same shape as wallet/subscription's
    // `*AlreadyExists` errors.
    const insert = db.makeQuery((execute, stripeEventId: string) =>
      execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO billing.webhook_events (stripe_event_id)
          VALUES (${stripeEventId})
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", (e) =>
          e.type === "unique_violation"
            ? Effect.fail(new WebhookEventAlreadyRecorded({ stripeEventId }))
            : Effect.die(e),
        ),
        translatePersistenceUnavailable,
        Effect.withSpan("WebhookEventRepository.insert"),
      ),
    );

    const findByStripeEventId = db.makeQuery((execute, stripeEventId: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.WebhookEventRowStd)`
          SELECT * FROM billing.webhook_events WHERE stripe_event_id = ${stripeEventId}
        `),
      ).pipe(
        Effect.map((row) =>
          row === null ? Option.none() : Option.some(WebhookEventMapper.toDomain(row)),
        ),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("WebhookEventRepository.findByStripeEventId"),
      ),
    );

    return WebhookEventRepository.of({ insert, findByStripeEventId });
  }),
);
