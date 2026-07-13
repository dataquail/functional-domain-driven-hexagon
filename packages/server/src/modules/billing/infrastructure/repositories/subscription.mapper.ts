import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { type ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

type Row = RowSchemas.SubscriptionRow;

// Resolves the specification field names the live repository filters on to
// physical columns of billing.subscriptions. Only filterable scalar fields
// need an entry; `satisfies` keeps the keys honest against the root.
export const columns = {
  organizationId: "organization_id",
  stripeSubscriptionId: "stripe_subscription_id",
} as const satisfies Partial<Record<keyof SubscriptionRoot, string>> & ColumnMap;

export const toDomain = (row: Row): SubscriptionRoot =>
  new SubscriptionRoot({
    id: SubscriptionId.make(row.id),
    organizationId: OrganizationId.make(row.organization_id),
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export type PersistenceRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly stripe_customer_id: string;
  readonly stripe_subscription_id: string;
  readonly status: string;
  readonly current_period_end: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
};

export const toPersistence = (sub: SubscriptionRoot): PersistenceRow => ({
  id: sub.id,
  organization_id: sub.organizationId,
  stripe_customer_id: sub.stripeCustomerId,
  stripe_subscription_id: sub.stripeSubscriptionId,
  status: sub.status,
  current_period_end: sub.currentPeriodEnd === null ? null : DateTime.toDate(sub.currentPeriodEnd),
  created_at: DateTime.toDate(sub.createdAt),
  updated_at: DateTime.toDate(sub.updatedAt),
});
