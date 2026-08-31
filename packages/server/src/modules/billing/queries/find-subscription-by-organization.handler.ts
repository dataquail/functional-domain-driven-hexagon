import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";

import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import {
  type FindSubscriptionByOrganizationPayload,
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

export const findSubscriptionByOrganizationHandler = Effect.fn(
  "findSubscriptionByOrganizationHandler",
)(function* (query: FindSubscriptionByOrganizationPayload) {
  const sql = yield* Database.Database;
  const row = yield* sql`
            SELECT * FROM billing.subscriptions WHERE organization_id = ${query.organizationId}
          `
    .pipe(Database.maybeRow(RowSchemas.SubscriptionRow))
    .pipe(translateDatabaseErrors);
  return row === null ? null : toView(row);
});
