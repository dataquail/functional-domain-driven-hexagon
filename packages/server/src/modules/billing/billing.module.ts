import * as Layer from "effect/Layer";

import { StripeWebhookEventAdapterLive } from "@/modules/billing/interface/events/stripe-webhook.event-adapter.js";
import { BillingLive, BillingWebhooksLive } from "@/modules/billing/interface/http/index.js";

// Two things live behind this Layer:
//   1. The HTTP groups (auth-gated + webhook).
//   2. The stripe-webhook event adapter (interface/events): a bus-only
//      inbound port that subscribes to `StripeWebhookIngested` and
//      dispatches a `SyncSubscriptionCommand`. It runs in the ingest
//      command's fiber and its dispatched command opens a nested savepoint
//      (ADR-0007). The command handler (billing.command-handlers.ts) owns
//      the SubscriptionRepository; the adapter touches no infrastructure,
//      so its bus deps are satisfied at the composition root.
//
// `BillingGateway` is not here: the command handlers own it, so the Stripe-vs-fake
// swap ships as `BillingCommands{Live,Fake}` and the Tag never leaves the module.
//
// No cross-module event adapters: billing doesn't consume any upstream
// module's events for MVP (the original outline had a "create Stripe
// customer when org is created" handler; we chose lazy-on-subscribe
// instead to keep external IO out of the org-create transaction).
export const BillingModuleLive = Layer.mergeAll(
  BillingLive,
  BillingWebhooksLive,
  StripeWebhookEventAdapterLive,
);
