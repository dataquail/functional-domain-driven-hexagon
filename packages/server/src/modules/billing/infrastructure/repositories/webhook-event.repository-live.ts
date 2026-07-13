import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event/webhook-event.errors.js";
import {
  type WebhookEventRecord,
  WebhookEventRepository,
} from "@/modules/billing/domain/webhook-event/webhook-event.repository.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import * as WebhookEventMapper from "./webhook-event.mapper.js";

export const WebhookEventRepositoryLive = Layer.effect(
  WebhookEventRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    // Race-free claim: Postgres' unique-key violation IS the
    // idempotency signal. The endpoint catches
    // `WebhookEventAlreadyRecorded` to short-circuit duplicate
    // deliveries — same shape as wallet/subscription's
    // `*AlreadyExists` errors.
    const insertOne = db.makeQuery((execute, stripeEventId: string) =>
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
        Effect.withSpan("WebhookEventRepository.insertOne"),
      ),
    );

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the unique stripe_event_id).
    const findOne = db.makeQuery((execute, spec: Specification<WebhookEventRecord>) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.WebhookEventRowStd)`
          SELECT * FROM billing.webhook_events
          WHERE ${criteriaToWhere(spec.criteria, WebhookEventMapper.columns)}
          LIMIT 1
        `),
      ).pipe(
        Effect.map((row) => (row === null ? null : WebhookEventMapper.toDomain(row))),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("WebhookEventRepository.findOne"),
      ),
    );

    return WebhookEventRepository.of({ insertOne, findOne });
  }),
);
