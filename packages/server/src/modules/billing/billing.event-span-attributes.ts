import {
  subscriptionCanceledSpanAttributes,
  subscriptionStartedSpanAttributes,
  subscriptionStatusChangedSpanAttributes,
} from "@/modules/billing/domain/subscription/subscription.events.js";
import { stripeWebhookIngestedSpanAttributes } from "@/modules/billing/domain/webhook-event/stripe-webhook.events.js";
import { eventSpanAttributes } from "@/platform/ddd/ports/domain-event-bus.js";

export const billingEventSpanAttributes = eventSpanAttributes({
  SubscriptionStarted: subscriptionStartedSpanAttributes,
  SubscriptionStatusChanged: subscriptionStatusChangedSpanAttributes,
  SubscriptionCanceled: subscriptionCanceledSpanAttributes,
  StripeWebhookIngested: stripeWebhookIngestedSpanAttributes,
});
