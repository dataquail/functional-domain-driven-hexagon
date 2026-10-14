import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { type Specification } from "@/globals/application/ddd/specification.ts";
import { criteriaToWhere } from "@/globals/infrastructure/database/criteria-to-sql.ts";
import {
  translateDatabaseErrors,
  translatePersistenceUnavailable,
} from "@/globals/infrastructure/database/translate-database-errors.ts";
import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription/subscription.errors.ts";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.ts";
import { type SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.ts";

import * as SubscriptionMapper from "./subscription.mapper.ts";

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
            ${Option.getOrNull(row.current_period_end)},
            ${row.created_at},
            ${row.updated_at}
          )
        `.pipe(
        Database.exec,
        Effect.catchTag("DatabaseError", (e) => {
          if (e.type === "unique_violation") {
            return Effect.fail(
              new SubscriptionAlreadyExistsForOrganization({ organizationId: sub.organizationId }),
            );
          }

          return Effect.die(e);
        }),
        translatePersistenceUnavailable,
      );
    });

    const updateOne = Effect.fn("SubscriptionRepository.updateOne")((sub: SubscriptionRoot) => {
      const row = SubscriptionMapper.toPersistence(sub);

      return sql`
          UPDATE billing.subscriptions
          SET
            status = ${row.status},
            current_period_end = ${Option.getOrNull(row.current_period_end)},
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
        criteriaToWhere(sql, spec.criteria, SubscriptionMapper.columns).pipe(
          Effect.flatMap(
            (where) => sql`
          SELECT * FROM billing.subscriptions
          WHERE ${where}
          LIMIT 1
        `,
          ),
          Database.maybeRow(RowSchemas.SubscriptionRow),

          Effect.map(Option.map(SubscriptionMapper.toDomain)),
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
