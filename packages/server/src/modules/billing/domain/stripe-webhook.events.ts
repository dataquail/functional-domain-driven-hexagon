import * as Schema from "effect/Schema";

import { StripeWebhookEvent } from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import { DomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";

// Emitted by `IngestStripeWebhookCommand` after a fresh webhook
// delivery has been verified and the idempotency claim is held.
// Carries the parsed Stripe event so downstream handlers can fan out
// by `type` without re-reading the wire payload. Same-module event
// (no cross-module ACL): subscribers live in `billing/event-handlers/`
// and consume `StripeWebhookIngested` directly.
export const StripeWebhookIngested = DomainEvent("StripeWebhookIngested", {
  stripeEvent: StripeWebhookEvent,
});
export type StripeWebhookIngested = typeof StripeWebhookIngested.Type;

export const stripeWebhookIngestedSpanAttributes: SpanAttributesExtractor<StripeWebhookIngested> = (
  event,
) => ({
  "stripe.event.id": event.stripeEvent.eventId,
  "stripe.event.type": event.stripeEvent.type,
});

// Helper for typed consumers — narrows the union to the subscription
// variants. Most event handlers care only about these cases.
export const isStripeSubscriptionEvent = Schema.is(
  Schema.Struct({
    eventId: Schema.String,
    type: Schema.Literals([
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ]),
    subscription: Schema.Struct({
      stripeSubscriptionId: Schema.String,
      status: Schema.String,
      currentPeriodEnd: Schema.NullOr(Schema.DateTimeUtc),
    }),
  }),
);
