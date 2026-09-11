import { Module } from "@org/module";
import * as Layer from "effect/Layer";

import {
  type BillingCommands,
  BillingCommandsFake,
  BillingCommandsLive,
} from "@/modules/billing/billing.command-handlers.js";
import { billingExports } from "@/modules/billing/billing.exports.js";
import { BillingQueriesLive } from "@/modules/billing/billing.query-handlers.js";
import { StripeWebhookEventAdapterLive } from "@/modules/billing/interface/events/stripe-webhook.event-adapter.js";
import { BillingLive, BillingWebhooksLive } from "@/modules/billing/interface/http/index.js";

// The `http` bundle carries two things:
//   1. The HTTP groups (auth-gated + webhook).
//   2. The stripe-webhook event adapter (interface/events): a bus-only inbound
//      port that subscribes to `StripeWebhookIngested` and dispatches a
//      `SyncSubscriptionCommand`. It runs in the ingest command's fiber and its
//      dispatched command opens a nested savepoint (ADR-0007).
//
// `BillingGateway` never appears here: the command handlers own it, so the
// Stripe-vs-fake swap is a choice of dispatch surface and the Tag stays private
// to the module. That is why this takes `Layer<BillingCommands>` and not
// `Layer<BillingGateway>` — the latter would re-leak the Tag through the
// signature. A third gateway shape ("Stripe is down", latency injector) ships as
// a third named surface in billing.command-handlers.ts and a third module here.
//
// No cross-module event adapters: billing doesn't consume any upstream module's
// events for MVP (the original outline had a "create Stripe customer when org is
// created" handler; we chose lazy-on-subscribe instead to keep external IO out of
// the org-create transaction).
const makeBillingModule = <RIn>(commands: Layer.Layer<BillingCommands, never, RIn>) =>
  Module.make("billing", Layer.mergeAll(commands, BillingQueriesLive), {
    exports: billingExports,
    http: Layer.mergeAll(BillingLive, BillingWebhooksLive, StripeWebhookEventAdapterLive),
  });

export const BillingModule = makeBillingModule(BillingCommandsLive);

export type BillingModule = typeof BillingModule;

// Annotated with the production type rather than inferred: a fake that demanded
// more than the real gateway would fail here instead of at the composition root.
export const BillingModuleFake: BillingModule = makeBillingModule(BillingCommandsFake);
