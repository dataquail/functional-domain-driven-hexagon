import * as Layer from "effect/Layer";

import { BillingGatewayFake } from "@/modules/billing/infrastructure/clients/billing-gateway.client-fake.js";
import { BillingGatewayLive } from "@/modules/billing/infrastructure/clients/billing-gateway.client-live.js";
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
// The module owns its DI graph. `BillingGateway` is consumed by the billing
// command handlers, whose requirement reaches the endpoints (via the typed
// bus) and is tracked by `HttpApiBuilder` as a request-scoped requirement. In
// v4 such a requirement is only satisfiable AFTER `HttpRouter.serve` unwraps
// it into a plain one — `HttpRouter.provideRequest` cannot reach routes
// registered through `HttpApiBuilder`'s group indirection (see
// OrganizationModuleLive for the full rationale). So the module publishes the
// gateway as an opaque bundled layer that the composition root provides
// post-serve. Two named variants ship the swap:
//   - `BillingHttpDepsLive` bundles `BillingGatewayLive` (prod).
//   - `BillingHttpDepsFake` bundles `BillingGatewayFake` (tests).
// Composition roots pick one. The `BillingGateway` Tag never leaves the
// module — the root only sees the opaque bundle — so testability stops being
// a reason to loosen `outbound-ports-private-to-use-cases`. If a future test
// ever needs a third gateway shape ("Stripe is down" simulator, latency
// injector), add a third named bundle here; don't reach for a factory that
// takes `Layer.Layer<BillingGateway>` — that would re-leak the Tag through
// its type signature.
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

export const BillingHttpDepsLive = BillingGatewayLive;

export const BillingHttpDepsFake = BillingGatewayFake;
