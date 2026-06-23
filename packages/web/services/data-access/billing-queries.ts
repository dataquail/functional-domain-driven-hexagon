// Billing data-access. Server-safe Effects only — pages prefetch via
// `billing-queries.server.ts`; client hooks live in
// `use-billing-queries.ts`.
//
// `current` is the only read; `start` and `cancel` are the two writes.
// Both mutations invalidate the per-org key so the panel re-reads the
// fresh subscription. The 404 case from `getCurrentSubscription` is
// folded into `null` here so the UI's empty state is plain data, not
// an error-channel concern.

import type { BillingContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";

import { QueryData } from "@/lib/tanstack-query";
import { ApiClient } from "@/services/api-client.shared";

type BillingKeyVars = { readonly orgId: OrganizationId };
type CurrentSubscription = BillingContract.SubscriptionResponse | null;

const billingKey = QueryData.makeQueryKey<"billing", BillingKeyVars>("billing");
const billingHelpers = QueryData.makeHelpers<CurrentSubscription, BillingKeyVars>(billingKey);

export const billingQueryKey = billingKey;

export const currentSubscriptionQuery = (orgId: OrganizationId) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.billing.getCurrentSubscription({ path: { orgId } }),
  ).pipe(
    Effect.map((sub): CurrentSubscription => sub),
    Effect.catchTag("SubscriptionNotFoundError", () => Effect.succeed<CurrentSubscription>(null)),
  );

export const startSubscription = (args: { readonly orgId: OrganizationId }) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.billing.startSubscription({ path: { orgId: args.orgId }, payload: {} }),
  ).pipe(Effect.tap(() => billingHelpers.invalidateAllQueries()));

export const cancelSubscription = (args: { readonly orgId: OrganizationId }) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.billing.cancelSubscription({ path: { orgId: args.orgId } }),
  ).pipe(Effect.tap(() => billingHelpers.invalidateAllQueries()));
