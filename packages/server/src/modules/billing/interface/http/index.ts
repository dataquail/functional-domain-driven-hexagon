import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { Api } from "@/api.js";
import { cancelSubscriptionEndpoint } from "@/modules/billing/interface/http/cancel-subscription.endpoint.js";
import { getCurrentSubscriptionEndpoint } from "@/modules/billing/interface/http/get-current-subscription.endpoint.js";
import { startSubscriptionEndpoint } from "@/modules/billing/interface/http/start-subscription.endpoint.js";
import { stripeWebhookEndpoint } from "@/modules/billing/interface/http/stripe-webhook.endpoint.js";

// Two contract groups, both wired here:
//   - `billing` (authenticated, org-scoped): the three subscription
//     CRUD endpoints under `/orgs/:orgId/billing/...`.
//   - `billingWebhooks` (public): the Stripe ingress at
//     `/webhooks/stripe`. Public because Stripe doesn't carry our
//     session cookie; signature verification gates entry.
export const BillingLive = HttpApiBuilder.group(Api, "billing", (handlers) =>
  handlers
    .handle("startSubscription", startSubscriptionEndpoint)
    .handle("getCurrentSubscription", getCurrentSubscriptionEndpoint)
    .handle("cancelSubscription", cancelSubscriptionEndpoint),
);

export const BillingWebhooksLive = HttpApiBuilder.group(Api, "billingWebhooks", (handlers) =>
  handlers.handle("handleStripeWebhook", stripeWebhookEndpoint),
);
