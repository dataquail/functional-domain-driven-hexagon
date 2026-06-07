import * as Layer from "effect/Layer";

import { SubscriptionRepositoryLive } from "@/modules/billing/infrastructure/subscription-repository-live.js";
import { WebhookEventRepositoryLive } from "@/modules/billing/infrastructure/webhook-event-repository-live.js";
import { BillingLive, BillingWebhooksLive } from "@/modules/billing/interface/http/billing-live.js";

// Mirrors `TodosModuleLive`: the HTTP layers consume the module's
// owned infra (repositories), discharged here. The `BillingGateway`
// is intentionally NOT bundled — it's the integration seam, swapped
// between `StripeBillingGatewayLive` (prod) and `FakeBillingGatewayLive`
// (tests) at the composition root.
//
// No event adapters: billing doesn't consume any upstream module's
// events for MVP (the original outline had a "create Stripe customer
// when org is created" handler; we chose lazy-on-subscribe instead to
// keep external IO out of the org-create transaction).
export const BillingModuleLive = Layer.mergeAll(BillingLive, BillingWebhooksLive).pipe(
  Layer.provide(SubscriptionRepositoryLive),
  Layer.provide(WebhookEventRepositoryLive),
);
