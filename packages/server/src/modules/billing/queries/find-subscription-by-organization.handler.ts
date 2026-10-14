import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors.ts";
import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.ts";

import {
  type FindSubscriptionByOrganizationPayload,
  type SubscriptionView,
} from "./find-subscription-by-organization.query.ts";

// Projects the `billing.subscriptions` row down to the cross-boundary
// `SubscriptionView` shape — clients don't need the Stripe id columns,
// and exposing them needlessly couples consumers to the gateway.
const toView = (row: RowSchemas.SubscriptionRow): SubscriptionView => ({
  id: SubscriptionId.make(row.id),
  organizationId: OrganizationId.make(row.organization_id),
  status: row.status,
  currentPeriodEnd: Option.fromNullOr(row.current_period_end),
});

export const findSubscriptionByOrganizationHandler = Effect.fn(
  "findSubscriptionByOrganizationHandler",
)(function* (query: FindSubscriptionByOrganizationPayload) {
  const sql = yield* Database.Database;

  const row = yield* sql`
            SELECT * FROM billing.subscriptions WHERE organization_id = ${query.organizationId}
          `.pipe(Database.maybeRow(RowSchemas.SubscriptionRow), translateDatabaseErrors);

  return Option.map(row, toView);
});
