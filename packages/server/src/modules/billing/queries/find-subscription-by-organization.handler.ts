import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import {
  type FindSubscriptionByOrganizationQuery,
  type SubscriptionView,
} from "./find-subscription-by-organization.query.js";

// Projects the `billing.subscriptions` row down to the cross-boundary
// `SubscriptionView` shape — clients don't need the Stripe id columns,
// and exposing them needlessly couples consumers to the gateway.
const toView = (row: RowSchemas.SubscriptionRow): SubscriptionView => ({
  id: SubscriptionId.make(row.id),
  organizationId: OrganizationId.make(row.organization_id),
  status: row.status,
  currentPeriodEnd: row.current_period_end,
});

export const findSubscriptionByOrganization = Effect.fn("findSubscriptionByOrganization")(
  function* (query: FindSubscriptionByOrganizationQuery) {
    const db = yield* Database.Database;
    const row = yield* db
      .makeQuery((execute) =>
        execute((client) =>
          client.maybeOne(sql.type(RowSchemas.SubscriptionRowStd)`
            SELECT * FROM billing.subscriptions WHERE organization_id = ${query.organizationId}
          `),
        ),
      )()
      .pipe(
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.catchTag("DatabaseUnavailable", (e) =>
          Effect.fail(new PersistenceUnavailable({ message: e.message })),
        ),
      );
    return row === null ? Option.none() : Option.some(toView(row));
  },
);
