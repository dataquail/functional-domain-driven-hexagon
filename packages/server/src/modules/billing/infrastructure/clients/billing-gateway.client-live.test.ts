import { describe, it } from "@effect/vitest";
import { ok, strictEqual } from "assert";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import Stripe from "stripe";

import { EnvVars } from "@/common/env-vars.js";
import { BillingGateway } from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import { InvalidWebhookSignature } from "@/modules/billing/domain/subscription.errors.js";
import { BillingGatewayLive } from "@/modules/billing/infrastructure/clients/billing-gateway.client-live.js";

// Unit coverage for the Stripe adapter's webhook path — the half of the
// port that is pure, local crypto + translation (no network): signature
// verification and the Stripe-event → domain-event mapping. The
// customer/subscription create/cancel calls hit Stripe's API and are
// exercised through the fake in the command tests; only `whsec_test`
// (the webhook secret the adapter reads from EnvVars) matters here.
const WEBHOOK_SECRET = "whsec_test";

// EnvVars only needs a config source, not real env. A fixed map satisfies
// the required keys; the Stripe secret is a throwaway test value.
const EnvVarsTest = EnvVars.layer.pipe(
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown(
        Object.fromEntries([
          ["APP_URL", "https://app.example.com"],
          ["DATABASE_URL", "postgres://test"],
          ["ZITADEL_ISSUER", "https://zitadel.test"],
          ["ZITADEL_CLIENT_ID", "client"],
          ["ZITADEL_CLIENT_SECRET", "secret"],
          ["SESSION_COOKIE_SECRET", "session-secret"],
          ["STRIPE_SECRET_KEY", "sk_test"],
          ["STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET],
          ["STRIPE_PRICE_ID_DEFAULT", "price_test"],
        ]),
      ),
    ),
  ),
);

// A local Stripe instance used only to compute a valid `Stripe-Signature`
// over a raw payload — the same HMAC the adapter's `constructEvent`
// re-derives. Both sides are local crypto over the exact bytes, so no
// network is involved.
const signer = new Stripe("sk_test");
const sign = (payload: string): string =>
  signer.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

// Return type inferred: EnvVarsTest adds ConfigError to the error channel.
const provide = <A, E>(effect: Effect.Effect<A, E, BillingGateway>) =>
  effect.pipe(Effect.provide(BillingGatewayLive), Effect.provide(EnvVarsTest));

describe("BillingGatewayLive.verifyAndParseWebhook", () => {
  it.effect("rejects a payload whose signature doesn't verify as InvalidWebhookSignature", () =>
    provide(
      Effect.gen(function* () {
        const gw = yield* BillingGateway;
        const error = yield* gw
          .verifyAndParseWebhook({ payload: "{}", signature: "t=1,v1=deadbeef" })
          .pipe(Effect.flip);
        ok(error instanceof InvalidWebhookSignature);
      }),
    ),
  );

  it.effect("maps a subscription event, reading current_period_end off the top level", () =>
    provide(
      Effect.gen(function* () {
        const gw = yield* BillingGateway;
        const payload = JSON.stringify({
          id: "evt_1",
          type: "customer.subscription.updated",
          data: { object: { id: "sub_1", status: "active", current_period_end: 1_700_000_000 } },
        });
        const event = yield* gw.verifyAndParseWebhook({ payload, signature: sign(payload) });
        strictEqual(event.eventId, "evt_1");
        if (event.type !== "customer.subscription.updated") throw new Error("expected sub event");
        strictEqual(event.subscription.stripeSubscriptionId, "sub_1");
        strictEqual(event.subscription.status, "active");
        ok(event.subscription.currentPeriodEnd !== null);
        strictEqual(DateTime.toEpochMillis(event.subscription.currentPeriodEnd), 1_700_000_000_000);
      }),
    ),
  );

  it.effect("falls back to items.data[0].current_period_end when the top level is absent", () =>
    provide(
      Effect.gen(function* () {
        const gw = yield* BillingGateway;
        const payload = JSON.stringify({
          id: "evt_2",
          type: "customer.subscription.created",
          data: {
            object: {
              id: "sub_2",
              status: "trialing",
              items: { data: [{ current_period_end: 1_800_000_000 }] },
            },
          },
        });
        const event = yield* gw.verifyAndParseWebhook({ payload, signature: sign(payload) });
        if (event.type !== "customer.subscription.created") throw new Error("expected sub event");
        ok(event.subscription.currentPeriodEnd !== null);
        strictEqual(DateTime.toEpochMillis(event.subscription.currentPeriodEnd), 1_800_000_000_000);
      }),
    ),
  );

  it.effect("reduces an invoice event to just its subscription reference", () =>
    provide(
      Effect.gen(function* () {
        const gw = yield* BillingGateway;
        const payload = JSON.stringify({
          id: "evt_3",
          type: "invoice.paid",
          data: { object: { id: "in_1", subscription: "sub_3" } },
        });
        const event = yield* gw.verifyAndParseWebhook({ payload, signature: sign(payload) });
        if (event.type !== "invoice.paid") throw new Error("expected invoice event");
        strictEqual(event.invoice.stripeSubscriptionId, "sub_3");
      }),
    ),
  );

  it.effect("records an unmodeled event type as `unknown` so the delivery is still acked", () =>
    provide(
      Effect.gen(function* () {
        const gw = yield* BillingGateway;
        const payload = JSON.stringify({
          id: "evt_4",
          type: "customer.created",
          data: { object: { id: "cus_1" } },
        });
        const event = yield* gw.verifyAndParseWebhook({ payload, signature: sign(payload) });
        strictEqual(event.type, "unknown");
        strictEqual(event.eventId, "evt_4");
      }),
    ),
  );
});
