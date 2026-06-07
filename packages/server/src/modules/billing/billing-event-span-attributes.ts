import {
  subscriptionCanceledSpanAttributes,
  subscriptionStartedSpanAttributes,
  subscriptionStatusChangedSpanAttributes,
} from "@/modules/billing/domain/subscription-events.js";
import { eventSpanAttributes } from "@/platform/ddd/ports/domain-event-bus.js";

export const billingEventSpanAttributes = eventSpanAttributes({
  SubscriptionStarted: subscriptionStartedSpanAttributes,
  SubscriptionStatusChanged: subscriptionStatusChangedSpanAttributes,
  SubscriptionCanceled: subscriptionCanceledSpanAttributes,
});
