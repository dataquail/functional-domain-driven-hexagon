import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event/webhook-event.errors.js";
import {
  type WebhookEventRecord,
  WebhookEventRepository,
} from "@/modules/billing/domain/webhook-event/webhook-event.repository.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import {
  translateDatabaseErrors,
  translatePersistenceUnavailable,
} from "@/platform/translate-database-errors.js";

import * as WebhookEventMapper from "./webhook-event.mapper.js";

export const WebhookEventRepositoryLive = Layer.effect(
  WebhookEventRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    // Race-free claim: Postgres' unique-key violation IS the
    // idempotency signal. The endpoint catches
    // `WebhookEventAlreadyRecorded` to short-circuit duplicate
    // deliveries — same shape as wallet/subscription's
    // `*AlreadyExists` errors.
    const insertOne = Effect.fn("WebhookEventRepository.insertOne")((stripeEventId: string) =>
      sql`
          INSERT INTO billing.webhook_events (stripe_event_id)
          VALUES (${stripeEventId})
        `.pipe(
        Database.exec,
        Effect.catchTag("DatabaseError", (e) =>
          e.type === "unique_violation"
            ? new WebhookEventAlreadyRecorded({ stripeEventId })
            : Effect.die(e),
        ),
        translatePersistenceUnavailable,
      ),
    );

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the unique stripe_event_id).
    const findOne = Effect.fn("WebhookEventRepository.findOne")(
      (spec: Specification<WebhookEventRecord>) =>
        sql`
          SELECT * FROM billing.webhook_events
          WHERE ${criteriaToWhere(sql, spec.criteria, WebhookEventMapper.columns)}
          LIMIT 1
        `.pipe(
          Database.maybeRow(RowSchemas.WebhookEventRow),

          Effect.map((row) => (row === null ? null : WebhookEventMapper.toDomain(row))),
          translateDatabaseErrors,
        ),
    );

    return WebhookEventRepository.of({ insertOne, findOne });
  }),
);
