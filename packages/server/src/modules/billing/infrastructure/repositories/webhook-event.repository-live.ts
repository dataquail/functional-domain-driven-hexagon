import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { type Specification } from "@/globals/application/ddd/specification.ts";
import { criteriaToWhere } from "@/globals/infrastructure/database/criteria-to-sql.ts";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors.ts";
import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event/webhook-event.errors.ts";
import {
  type WebhookEventRecord,
  WebhookEventRepository,
} from "@/modules/billing/domain/webhook-event/webhook-event.repository.ts";

import * as WebhookEventMapper from "./webhook-event.mapper.ts";

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
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new WebhookEventAlreadyRecorded({ stripeEventId })),
            onSome: () => Effect.void,
          }),
        ),
        translateDatabaseErrors,
      ),
    );

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the unique stripe_event_id).
    const findOne = Effect.fn("WebhookEventRepository.findOne")(
      (spec: Specification<WebhookEventRecord>) =>
        criteriaToWhere(sql, spec.criteria, WebhookEventMapper.columns).pipe(
          Effect.flatMap(
            (where) => sql`
          SELECT * FROM billing.webhook_events
          WHERE ${where}
          LIMIT 1
        `,
          ),
          Database.maybeRow(RowSchemas.WebhookEventRow),

          Effect.map(Option.map(WebhookEventMapper.toDomain)),
          translateDatabaseErrors,
        ),
    );

    return WebhookEventRepository.of({ insertOne, findOne });
  }),
);
