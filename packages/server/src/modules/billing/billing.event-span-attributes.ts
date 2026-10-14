import { Event } from "@effect-server-utils/cqrs";

import {
  subscriptionCanceledSpanAttributes,
  subscriptionStartedSpanAttributes,
  subscriptionStatusChangedSpanAttributes,
} from "@/modules/billing/domain/subscription/subscription.events.ts";
import { stripeWebhookIngestedSpanAttributes } from "@/modules/billing/domain/webhook-event/stripe-webhook.events.ts";

export const billingEventSpanAttributes = Event.spanAttributes({
  SubscriptionStarted: subscriptionStartedSpanAttributes,
  SubscriptionStatusChanged: subscriptionStatusChangedSpanAttributes,
  SubscriptionCanceled: subscriptionCanceledSpanAttributes,
  StripeWebhookIngested: stripeWebhookIngestedSpanAttributes,
});
