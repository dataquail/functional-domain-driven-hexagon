import * as HttpApiClient from "@effect/platform/HttpApiClient";
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import { describe, it } from "@effect/vitest";
import { BillingContract } from "@org/contracts/api/Contracts";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";

import { Api } from "@/api.js";
import { FAKE_WEBHOOK_SIGNATURE } from "@/modules/billing/index.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";

// The fake billing gateway's `sub_test_N` counter persists across
// tests inside one describe (the runtime is created in beforeAll;
// beforeEach truncates the DB but not the gateway's Ref). So a test
// can't hardcode "sub_test_1" — it has to discover the actual Stripe
// id assigned to its freshly-subscribed org by reading the DB.
const readStripeSubId = (orgId: OrganizationId) =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    const rows = yield* db
      .execute((c) =>
        c.any(sql.unsafe`
          SELECT stripe_subscription_id FROM billing.subscriptions
          WHERE organization_id = ${orgId}
        `),
      )
      .pipe(Effect.orDie);
    const first = rows[0] as { stripe_subscription_id?: string } | undefined;
    if (first?.stripe_subscription_id === undefined) {
      throw new Error("readStripeSubId: no subscription row for org");
    }
    return first.stripe_subscription_id;
  });

const BILLING_TABLES = [
  "billing.subscriptions",
  "billing.webhook_events",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

const suite = hasTestDatabase ? describe.sequential : describe.skip;

// The webhook endpoint reads raw bytes via `HttpServerRequest.text`
// (Stripe's `constructEvent` requires the EXACT bytes the signature
// was computed over), so we can't drive it through `HttpApiClient`
// — that does payload-shape decoding. Instead, drive the in-memory
// `HttpClient` directly with a POST body, mirroring how Stripe would
// deliver the event.

suite("POST /webhooks/stripe (integration)", () => {
  const { run } = useServerTestRuntime(BILLING_TABLES, { seedSuperAdminCaller: true });

  it("flips an existing subscription's status when delivered an updated event", async () => {
    await run(
      Effect.gen(function* () {
        const apiClient = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* apiClient.organization.create({ payload: { name: "Acme" } });
        const sub = yield* apiClient.billing.startSubscription({
          path: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });
        const stripeSubId = yield* readStripeSubId(orgId);
        const httpClient = yield* HttpClient.HttpClient;
        const event = {
          eventId: "evt_test_webhook_1",
          type: "customer.subscription.updated",
          subscription: {
            stripeSubscriptionId: stripeSubId,
            status: "past_due",
            currentPeriodEnd: null,
          },
        };
        const res = yield* httpClient.execute(
          HttpClientRequest.post("/webhooks/stripe").pipe(
            HttpClientRequest.setHeader("stripe-signature", FAKE_WEBHOOK_SIGNATURE),
            HttpClientRequest.bodyText(JSON.stringify(event)),
          ),
        );
        deepStrictEqual(res.status, 204);

        // The GET endpoint reflects the new status.
        const after = yield* apiClient.billing.getCurrentSubscription({ path: { orgId } });
        deepStrictEqual(after.status, "past_due");
        // Sanity: the original subscribed sub id is unchanged.
        deepStrictEqual(after.id, sub.id);
      }),
    );
  });

  it("returns 401 on a bad signature without dispatching commands", async () => {
    await run(
      Effect.gen(function* () {
        const apiClient = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* apiClient.organization.create({ payload: { name: "Acme" } });
        yield* apiClient.billing.startSubscription({
          path: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });
        const stripeSubId = yield* readStripeSubId(orgId);
        const httpClient = yield* HttpClient.HttpClient;
        const event = {
          eventId: "evt_test_bad_sig",
          type: "customer.subscription.updated",
          subscription: {
            stripeSubscriptionId: stripeSubId,
            status: "past_due",
            currentPeriodEnd: null,
          },
        };
        const res = yield* httpClient.execute(
          HttpClientRequest.post("/webhooks/stripe").pipe(
            HttpClientRequest.setHeader("stripe-signature", "totally-wrong-signature"),
            HttpClientRequest.bodyText(JSON.stringify(event)),
          ),
        );
        deepStrictEqual(res.status, 401);
        // Subscription status unchanged.
        const after = yield* apiClient.billing.getCurrentSubscription({ path: { orgId } });
        deepStrictEqual(after.status, "active");
      }),
    );
  });

  it("is idempotent: redelivering the same event id does not fire a second command dispatch", async () => {
    await run(
      Effect.gen(function* () {
        const apiClient = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* apiClient.organization.create({ payload: { name: "Acme" } });
        yield* apiClient.billing.startSubscription({
          path: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });
        const stripeSubId = yield* readStripeSubId(orgId);
        const httpClient = yield* HttpClient.HttpClient;
        const send = (status: string) =>
          httpClient.execute(
            HttpClientRequest.post("/webhooks/stripe").pipe(
              HttpClientRequest.setHeader("stripe-signature", FAKE_WEBHOOK_SIGNATURE),
              HttpClientRequest.bodyText(
                JSON.stringify({
                  eventId: "evt_test_dedup",
                  type: "customer.subscription.updated",
                  subscription: {
                    stripeSubscriptionId: stripeSubId,
                    status,
                    currentPeriodEnd: null,
                  },
                }),
              ),
            ),
          );

        const first = yield* send("past_due");
        deepStrictEqual(first.status, 204);
        const afterFirst = yield* apiClient.billing.getCurrentSubscription({ path: { orgId } });
        deepStrictEqual(afterFirst.status, "past_due");

        // Second delivery uses the SAME event id but a DIFFERENT status.
        // Idempotency must short-circuit before the command dispatch,
        // so the subscription stays at `past_due`.
        const second = yield* send("canceled");
        deepStrictEqual(second.status, 204);
        const afterSecond = yield* apiClient.billing.getCurrentSubscription({ path: { orgId } });
        deepStrictEqual(afterSecond.status, "past_due");
      }),
    );
  });

  it("is tolerant of unknown event types (200, no command dispatch)", async () => {
    await run(
      Effect.gen(function* () {
        const apiClient = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* apiClient.organization.create({ payload: { name: "Acme" } });
        yield* apiClient.billing.startSubscription({
          path: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });
        const httpClient = yield* HttpClient.HttpClient;
        const res = yield* httpClient.execute(
          HttpClientRequest.post("/webhooks/stripe").pipe(
            HttpClientRequest.setHeader("stripe-signature", FAKE_WEBHOOK_SIGNATURE),
            HttpClientRequest.bodyText(
              JSON.stringify({ eventId: "evt_test_unknown", type: "unknown" }),
            ),
          ),
        );
        deepStrictEqual(res.status, 204);
        const after = yield* apiClient.billing.getCurrentSubscription({ path: { orgId } });
        deepStrictEqual(after.status, "active");
        ok(after.id.length > 0);
      }),
    );
  });
});
