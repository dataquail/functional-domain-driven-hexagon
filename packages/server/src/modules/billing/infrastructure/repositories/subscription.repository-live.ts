import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription/subscription.errors.js";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.js";
import { type SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import * as SubscriptionMapper from "./subscription.mapper.js";

export const SubscriptionRepositoryLive = Layer.effect(
  SubscriptionRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insertOne = db.makeQuery((execute, sub: SubscriptionRoot) => {
      const row = SubscriptionMapper.toPersistence(sub);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO billing.subscriptions (
            id,
            organization_id,
            stripe_customer_id,
            stripe_subscription_id,
            status,
            current_period_end,
            created_at,
            updated_at
          )
          VALUES (
            ${row.id},
            ${row.organization_id},
            ${row.stripe_customer_id},
            ${row.stripe_subscription_id},
            ${row.status},
            ${row.current_period_end === null ? null : sql.timestamp(row.current_period_end)},
            ${sql.timestamp(row.created_at)},
            ${sql.timestamp(row.updated_at)}
          )
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", (e) =>
          e.type === "unique_violation"
            ? Effect.fail(
                new SubscriptionAlreadyExistsForOrganization({
                  organizationId: sub.organizationId,
                }),
              )
            : Effect.die(e),
        ),
        translatePersistenceUnavailable,
        Effect.withSpan("SubscriptionRepository.insertOne"),
      );
    });

    const updateOne = db.makeQuery((execute, sub: SubscriptionRoot) => {
      const row = SubscriptionMapper.toPersistence(sub);
      return execute((client) =>
        client.query(sql.unsafe`
          UPDATE billing.subscriptions
          SET
            status = ${row.status},
            current_period_end = ${
              row.current_period_end === null ? null : sql.timestamp(row.current_period_end)
            },
            updated_at = ${sql.timestamp(row.updated_at)}
          WHERE id = ${row.id}
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("SubscriptionRepository.updateOne"),
      );
    });

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the unique organization_id, the unique
    // stripe_subscription_id).
    const findOne = db.makeQuery((execute, spec: Specification<SubscriptionRoot>) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.SubscriptionRowStd)`
          SELECT * FROM billing.subscriptions
          WHERE ${criteriaToWhere(spec.criteria, SubscriptionMapper.columns)}
          LIMIT 1
        `),
      ).pipe(
        Effect.map((row) => (row === null ? null : SubscriptionMapper.toDomain(row))),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("SubscriptionRepository.findOne"),
      ),
    );

    return SubscriptionRepository.of({
      insertOne,
      updateOne,
      findOne,
    });
  }),
);
