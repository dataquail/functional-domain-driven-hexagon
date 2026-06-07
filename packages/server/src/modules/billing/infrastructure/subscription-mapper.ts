import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { Subscription } from "@/modules/billing/domain/subscription.aggregate.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

type Row = RowSchemas.SubscriptionRow;

export const toDomain = (row: Row): Subscription =>
  new Subscription({
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

export const toPersistence = (sub: Subscription): PersistenceRow => ({
  id: sub.id,
  organization_id: sub.organizationId,
  stripe_customer_id: sub.stripeCustomerId,
  stripe_subscription_id: sub.stripeSubscriptionId,
  status: sub.status,
  current_period_end: sub.currentPeriodEnd === null ? null : DateTime.toDate(sub.currentPeriodEnd),
  created_at: DateTime.toDate(sub.createdAt),
  updated_at: DateTime.toDate(sub.updatedAt),
});
