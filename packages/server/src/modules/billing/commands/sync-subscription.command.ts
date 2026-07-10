import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";

// Syncs the local Subscription projection to a Stripe-reported status.
// Dispatched by the stripe-webhook event adapter (interface/events) for
// subscription lifecycle events — Stripe vocabulary is translated to these
// domain fields in the adapter, so this command carries no Stripe types.
export const SyncSubscriptionCommand = Schema.TaggedStruct("SyncSubscriptionCommand", {
  stripeSubscriptionId: Schema.String,
  status: Schema.String,
  currentPeriodEnd: Schema.NullOr(Schema.DateTimeUtc),
});
export type SyncSubscriptionCommand = typeof SyncSubscriptionCommand.Type;

export const syncSubscriptionCommandSpanAttributes: SpanAttributesExtractor<
  SyncSubscriptionCommand
> = (cmd) => ({
  "stripe.subscription.id": cmd.stripeSubscriptionId,
  "subscription.status": cmd.status,
});
