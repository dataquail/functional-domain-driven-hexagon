import { Event } from "@org/cqrs";

import {
  subscriptionCanceledSpanAttributes,
  subscriptionStartedSpanAttributes,
  subscriptionStatusChangedSpanAttributes,
} from "@/modules/billing/domain/subscription/subscription.events.js";
import { stripeWebhookIngestedSpanAttributes } from "@/modules/billing/domain/webhook-event/stripe-webhook.events.js";

export const billingEventSpanAttributes = Event.spanAttributes({
  SubscriptionStarted: subscriptionStartedSpanAttributes,
  SubscriptionStatusChanged: subscriptionStatusChangedSpanAttributes,
  SubscriptionCanceled: subscriptionCanceledSpanAttributes,
  StripeWebhookIngested: stripeWebhookIngestedSpanAttributes,
});
