import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription-repository.js";
import { type Subscription } from "@/modules/billing/domain/subscription.aggregate.js";
import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription-errors.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import * as SubscriptionMapper from "./subscription-mapper.js";

export const SubscriptionRepositoryLive = Layer.effect(
  SubscriptionRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insert = db.makeQuery((execute, sub: Subscription) => {
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
        Effect.withSpan("SubscriptionRepository.insert"),
      );
    });

    const update = db.makeQuery((execute, sub: Subscription) => {
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
        Effect.withSpan("SubscriptionRepository.update"),
      );
    });

    const findByOrganizationId = db.makeQuery((execute, organizationId: OrganizationId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.SubscriptionRowStd)`
          SELECT * FROM billing.subscriptions WHERE organization_id = ${organizationId}
        `),
      ).pipe(
        Effect.map((row) =>
          row === null ? Option.none() : Option.some(SubscriptionMapper.toDomain(row)),
        ),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("SubscriptionRepository.findByOrganizationId"),
      ),
    );

    const findByStripeSubscriptionId = db.makeQuery((execute, stripeSubscriptionId: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.SubscriptionRowStd)`
          SELECT * FROM billing.subscriptions WHERE stripe_subscription_id = ${stripeSubscriptionId}
        `),
      ).pipe(
        Effect.map((row) =>
          row === null ? Option.none() : Option.some(SubscriptionMapper.toDomain(row)),
        ),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("SubscriptionRepository.findByStripeSubscriptionId"),
      ),
    );

    return SubscriptionRepository.of({
      insert,
      update,
      findByOrganizationId,
      findByStripeSubscriptionId,
    });
  }),
);
