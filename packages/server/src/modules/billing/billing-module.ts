import * as Layer from "effect/Layer";

import { SyncSubscriptionFromStripeWebhookLive } from "@/modules/billing/event-handlers/sync-subscription-from-stripe-webhook.js";
import { SubscriptionRepositoryLive } from "@/modules/billing/infrastructure/subscription-repository-live.js";
import { WebhookEventRepositoryLive } from "@/modules/billing/infrastructure/webhook-event-repository-live.js";
import { BillingLive, BillingWebhooksLive } from "@/modules/billing/interface/http/billing-live.js";

// Three things live behind this Layer:
//   1. The HTTP groups (auth-gated + webhook).
//   2. The same-module event subscriber that syncs the local
//      `Subscription` projection off `StripeWebhookIngested` (acts as
//      a use case directly, per the dep-cruise event-handlers-isolation
//      rule). Runs in the publisher's fiber and inherits the
//      transaction (ADR-0007), so the ingest claim and the status
//      mutation commit/roll back as one unit.
//   3. The repos both the HTTP layers and the event handler need.
//
// `BillingGateway` is intentionally NOT bundled — it's the integration
// seam, swapped between `StripeBillingGatewayLive` (prod) and
// `FakeBillingGatewayLive` (tests) at the composition root.
//
// No cross-module event adapters: billing doesn't consume any upstream
// module's events for MVP (the original outline had a "create Stripe
// customer when org is created" handler; we chose lazy-on-subscribe
// instead to keep external IO out of the org-create transaction).
export const BillingModuleLive = Layer.mergeAll(
  BillingLive,
  BillingWebhooksLive,
  SyncSubscriptionFromStripeWebhookLive,
).pipe(Layer.provide(SubscriptionRepositoryLive), Layer.provide(WebhookEventRepositoryLive));
