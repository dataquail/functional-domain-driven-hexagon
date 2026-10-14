import * as Schema from "effect/Schema";

import * as Event from "@/globals/application/ddd/domain-event.ts";
import { type SpanAttributesExtractor } from "@/globals/application/ddd/domain-event.ts";
import {
  StripeSubscriptionWebhookEvent,
  StripeWebhookEvent,
} from "@/modules/billing/domain/webhook-event/stripe-webhook.value-object.ts";

// Emitted by `IngestStripeWebhookCommand` after a fresh webhook
// delivery has been verified and the idempotency claim is held.
// Carries the parsed Stripe event so a subscriber can fan out by `type`
// without re-reading the wire payload.
export const StripeWebhookIngested = Event.make("StripeWebhookIngested", {
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
export const isStripeSubscriptionEvent = Schema.is(StripeSubscriptionWebhookEvent);
