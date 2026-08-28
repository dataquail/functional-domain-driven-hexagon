import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription/subscription.errors.js";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.js";
import { type SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import {
  translateDatabaseErrors,
  translatePersistenceUnavailable,
} from "@/platform/translate-database-errors.js";

import * as SubscriptionMapper from "./subscription.mapper.js";

export const SubscriptionRepositoryLive = Layer.effect(
  SubscriptionRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    const insertOne = Effect.fn("SubscriptionRepository.insertOne")((sub: SubscriptionRoot) => {
      const row = SubscriptionMapper.toPersistence(sub);
      return sql`
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
            ${row.current_period_end},
            ${row.created_at},
            ${row.updated_at}
          )
        `.pipe(
        Database.exec,
        Effect.catchTag("DatabaseError", (e) =>
          e.type === "unique_violation"
            ? new SubscriptionAlreadyExistsForOrganization({
                organizationId: sub.organizationId,
              })
            : Effect.die(e),
        ),
        translatePersistenceUnavailable,
      );
    });

    const updateOne = Effect.fn("SubscriptionRepository.updateOne")((sub: SubscriptionRoot) => {
      const row = SubscriptionMapper.toPersistence(sub);
      return sql`
          UPDATE billing.subscriptions
          SET
            status = ${row.status},
            current_period_end = ${row.current_period_end},
            updated_at = ${row.updated_at}
          WHERE id = ${row.id}
        `.pipe(Database.exec, translateDatabaseErrors);
    });

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the unique organization_id, the unique
    // stripe_subscription_id).
    const findOne = Effect.fn("SubscriptionRepository.findOne")(
      (spec: Specification<SubscriptionRoot>) =>
        sql`
          SELECT * FROM billing.subscriptions
          WHERE ${criteriaToWhere(sql, spec.criteria, SubscriptionMapper.columns)}
          LIMIT 1
        `.pipe(
          Database.maybeRow(RowSchemas.SubscriptionRow),

          Effect.map((row) => (row === null ? null : SubscriptionMapper.toDomain(row))),
          translateDatabaseErrors,
        ),
    );

    return SubscriptionRepository.of({
      insertOne,
      updateOne,
      findOne,
    });
  }),
);
