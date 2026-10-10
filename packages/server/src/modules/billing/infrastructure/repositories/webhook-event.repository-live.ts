import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type Specification } from "@/globals/application/ddd/specification.js";
import { criteriaToWhere } from "@/globals/infrastructure/database/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors.js";
import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event/webhook-event.errors.js";
import {
  type WebhookEventRecord,
  WebhookEventRepository,
} from "@/modules/billing/domain/webhook-event/webhook-event.repository.js";

import * as WebhookEventMapper from "./webhook-event.mapper.js";

export const WebhookEventRepositoryLive = Layer.effect(
  WebhookEventRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    // Race-free claim that leaves the transaction usable: a duplicate is caught
    // and the delivery still commits, which a unique violation would abort.
    const insertOne = Effect.fn("WebhookEventRepository.insertOne")((stripeEventId: string) =>
      sql`
          INSERT INTO billing.webhook_events (stripe_event_id)
          VALUES (${stripeEventId})
          ON CONFLICT (stripe_event_id) DO NOTHING
          RETURNING *
        `.pipe(
        Database.maybeRow(RowSchemas.WebhookEventRow),
        Effect.flatMap((claimed) =>
          claimed === null
            ? Effect.fail(new WebhookEventAlreadyRecorded({ stripeEventId }))
            : Effect.void,
        ),
        translateDatabaseErrors,
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
