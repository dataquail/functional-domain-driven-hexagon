// Billing fixtures for the integration tier. Each factory returns a
// contract-shape object with sensible defaults so tests can override
// only the fields they care about. The drift gate is the sibling test:
// each fixture's default output must decode through the contract's
// response schema.

import * as BillingContract from "@org/contracts/api/BillingContract";
import { OrganizationId, SubscriptionId } from "@org/contracts/EntityIds";
import * as DateTime from "effect/DateTime";

const FIXED_DATE = DateTime.makeUnsafe(new Date("2026-03-01T00:00:00Z"));

export const BILLING_ORG_ID = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const SUBSCRIPTION_ID = SubscriptionId.make("22222222-2222-2222-2222-222222222222");

/** A valid `SubscriptionResponse`; `status` defaults to Stripe's `active`. */
export const makeSubscription = (
  overrides: Partial<BillingContract.SubscriptionResponse> = {},
): BillingContract.SubscriptionResponse =>
  new BillingContract.SubscriptionResponse({
    id: SUBSCRIPTION_ID,
    organizationId: BILLING_ORG_ID,
    status: "active",
    currentPeriodEnd: FIXED_DATE,
    ...overrides,
  });
