import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { SubscriptionId } from "./subscription.id.js";

// Aggregate root data — a dumb value (ADR-0003). Operations live in
// `subscription.root-ops.ts` (`SubscriptionRootOps`) and carry the test
// obligation.
//
// `status` is a free-form string. The Stripe vocabulary
// (`active | past_due | canceled | trialing | incomplete | unpaid | ...`)
// is not enumerated in the aggregate because:
//   1. Stripe owns the lifecycle. New statuses ship without notice.
//   2. We never make a domain decision based on this string — it's a
//      projection rendered through to the API consumer. Other modules
//      that need a coarser "is this org paid?" question should ask the
//      domain method instead of inspecting the literal.
export class SubscriptionRoot extends Schema.Class<SubscriptionRoot>("SubscriptionRoot")({
  id: SubscriptionId,
  organizationId: OrganizationId,
  stripeCustomerId: Schema.String,
  stripeSubscriptionId: Schema.String,
  status: Schema.String,
  currentPeriodEnd: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}
