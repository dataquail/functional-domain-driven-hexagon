import * as Layer from "effect/Layer";

import { SyncSubscriptionFromStripeWebhookLive } from "@/modules/billing/event-handlers/sync-subscription-from-stripe-webhook.js";
import { FakeBillingGatewayLive } from "@/modules/billing/infrastructure/fake-billing-gateway.js";
import { StripeBillingGatewayLive } from "@/modules/billing/infrastructure/stripe-billing-gateway-live.js";
import { SubscriptionRepositoryLive } from "@/modules/billing/infrastructure/subscription-repository-live.js";
import { WebhookEventRepositoryLive } from "@/modules/billing/infrastructure/webhook-event-repository-live.js";
import { BillingLive, BillingWebhooksLive } from "@/modules/billing/interface/http/billing-live.js";

// Three things live behind this Layer:
//   1. The HTTP groups (auth-gated + webhook).
//   2. The same-module event subscriber that syncs the local
//      `Subscription` projection off `StripeWebhookIngested` (acts as
//      a use case directly, per the dep-cruise event-handlers-isolation
//      rule). Runs in the publisher's fiber and inherits the
//      transaction (ADR-0007).
//   3. The infra Lives those layers need.
//
// The module owns its DI graph. Two named variants ship the swap for
// `BillingGateway`:
//   - `BillingModuleLive`     bundles `StripeBillingGatewayLive` (prod).
//   - `BillingModuleTestLive` bundles `FakeBillingGatewayLive` (tests).
// Composition roots pick one. The `BillingGateway` Tag never leaves
// the module's use-case ring — testability stops being a reason to
// loosen `outbound-ports-private-to-use-cases`.
//
// If a future test ever needs a third gateway shape ("Stripe is
// down" simulator, latency injector), add a third named Live here;
// don't reach for a factory that takes `Layer.Layer<BillingGateway>`
// — that would re-leak the Tag through its type signature.
//
// No cross-module event adapters: billing doesn't consume any upstream
// module's events for MVP (the original outline had a "create Stripe
// customer when org is created" handler; we chose lazy-on-subscribe
// instead to keep external IO out of the org-create transaction).
const BillingModuleBase = Layer.mergeAll(
  BillingLive,
  BillingWebhooksLive,
  SyncSubscriptionFromStripeWebhookLive,
).pipe(Layer.provide(SubscriptionRepositoryLive), Layer.provide(WebhookEventRepositoryLive));

export const BillingModuleLive = BillingModuleBase.pipe(Layer.provide(StripeBillingGatewayLive));

export const BillingModuleTestLive = BillingModuleBase.pipe(Layer.provide(FakeBillingGatewayLive));
