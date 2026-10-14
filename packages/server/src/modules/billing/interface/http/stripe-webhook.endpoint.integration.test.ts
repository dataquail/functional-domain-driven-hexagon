import { deepStrictEqual, ok } from "node:assert";

import { BillingContract, OrganizationContract } from "@org/contracts/api/Contracts";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { Api } from "@/globals/infrastructure/framework/http/api";
import { StripeWebhookEvent } from "@/modules/billing/domain/webhook-event/stripe-webhook.value-object";
import { FAKE_WEBHOOK_SIGNATURE } from "@/modules/billing/infrastructure/clients/billing-gateway.client-fake";
import { describeServer } from "@/test-utils/server-test-runtime";
import { TestServerLiveAsMember } from "@/test-utils/test-server";

// The fake billing gateway's `sub_test_N` counter persists across
// tests inside one describe (the server layer is built once per block;
// each test truncates the DB but not the gateway's Ref). So a test
// can't hardcode "sub_test_1" — it has to discover the actual Stripe
// id assigned to its freshly-subscribed org by reading the DB.
const StripeSubscriptionIdRow = Schema.Struct({ stripe_subscription_id: Schema.String });

const encodeWebhookPayload = Schema.encodeSync(Schema.fromJsonString(StripeWebhookEvent));

const readStripeSubId = (orgId: OrganizationId) =>
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    const row = yield* sql`
          SELECT stripe_subscription_id FROM billing.subscriptions
          WHERE organization_id = ${orgId}
        `.pipe(Database.maybeRow(StripeSubscriptionIdRow), Effect.flatMap(Effect.fromOption));

    return row.stripe_subscription_id;
  }).pipe(Effect.orDie);

const BILLING_TABLES = [
  "billing.subscriptions",
  "billing.webhook_events",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

// The webhook endpoint reads raw bytes via `HttpServerRequest.text`
// (Stripe's `constructEvent` requires the EXACT bytes the signature
// was computed over), so we can't drive it through `HttpApiClient`
// — that does payload-shape decoding. Instead, drive the in-memory
// `HttpClient` directly with a POST body, mirroring how Stripe would
// deliver the event.

describeServer(
  "POST /webhooks/stripe (integration)",
  { tables: BILLING_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("flips an existing subscription's status when delivered an updated event", () =>
      Effect.gen(function* () {
        const apiClient = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* apiClient.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const sub = yield* apiClient.billing.startSubscription({
          params: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });

        const stripeSubId = yield* readStripeSubId(orgId);
        const httpClient = yield* HttpClient.HttpClient;

        const event: StripeWebhookEvent = {
          eventId: "evt_test_webhook_1",
          type: "customer.subscription.updated",
          subscription: {
            stripeSubscriptionId: stripeSubId,
            status: "past_due",
            currentPeriodEnd: Option.none(),
          },
        };

        const res = yield* httpClient.execute(
          HttpClientRequest.post("/webhooks/stripe").pipe(
            HttpClientRequest.setHeader("stripe-signature", FAKE_WEBHOOK_SIGNATURE),
            HttpClientRequest.bodyText(encodeWebhookPayload(event)),
          ),
        );

        // `Schema.Void` success responds 200 in effect v4 (v3 defaulted
        // empty-body success to 204). Any 2xx satisfies Stripe; the
        // contract documents 200 as the intended status.
        deepStrictEqual(res.status, 200);

        // The GET endpoint reflects the new status.
        const after = yield* apiClient.billing.getCurrentSubscription({ params: { orgId } });
        deepStrictEqual(after.status, "past_due");
        // Sanity: the original subscribed sub id is unchanged.
        deepStrictEqual(after.id, sub.id);
      }),
    );

    it.effect("returns 401 on a bad signature without dispatching commands", () =>
      Effect.gen(function* () {
        const apiClient = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* apiClient.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        yield* apiClient.billing.startSubscription({
          params: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });
        const stripeSubId = yield* readStripeSubId(orgId);
        const httpClient = yield* HttpClient.HttpClient;

        const event: StripeWebhookEvent = {
          eventId: "evt_test_bad_sig",
          type: "customer.subscription.updated",
          subscription: {
            stripeSubscriptionId: stripeSubId,
            status: "past_due",
            currentPeriodEnd: Option.none(),
          },
        };

        const res = yield* httpClient.execute(
          HttpClientRequest.post("/webhooks/stripe").pipe(
            HttpClientRequest.setHeader("stripe-signature", "totally-wrong-signature"),
            HttpClientRequest.bodyText(encodeWebhookPayload(event)),
          ),
        );

        deepStrictEqual(res.status, 401);
        // Subscription status unchanged.
        const after = yield* apiClient.billing.getCurrentSubscription({ params: { orgId } });
        deepStrictEqual(after.status, "active");
      }),
    );

    it.effect(
      "is idempotent: redelivering the same event id does not fire a second command dispatch",
      () =>
        Effect.gen(function* () {
          const apiClient = yield* HttpApiClient.make(Api);

          const { id: orgId } = yield* apiClient.organization.create({
            payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
          });

          yield* apiClient.billing.startSubscription({
            params: { orgId },
            payload: new BillingContract.StartSubscriptionPayload(),
          });
          const stripeSubId = yield* readStripeSubId(orgId);
          const httpClient = yield* HttpClient.HttpClient;

          const send = (status: string) =>
            httpClient.execute(
              HttpClientRequest.post("/webhooks/stripe").pipe(
                HttpClientRequest.setHeader("stripe-signature", FAKE_WEBHOOK_SIGNATURE),
                HttpClientRequest.bodyText(
                  encodeWebhookPayload({
                    eventId: "evt_test_dedup",
                    type: "customer.subscription.updated",
                    subscription: {
                      stripeSubscriptionId: stripeSubId,
                      status,
                      currentPeriodEnd: Option.none(),
                    },
                  }),
                ),
              ),
            );

          const first = yield* send("past_due");
          deepStrictEqual(first.status, 200);
          const afterFirst = yield* apiClient.billing.getCurrentSubscription({ params: { orgId } });
          deepStrictEqual(afterFirst.status, "past_due");

          // Second delivery uses the SAME event id but a DIFFERENT status.
          // Idempotency must short-circuit before the command dispatch,
          // so the subscription stays at `past_due`.
          const second = yield* send("canceled");
          deepStrictEqual(second.status, 200);

          const afterSecond = yield* apiClient.billing.getCurrentSubscription({
            params: { orgId },
          });

          deepStrictEqual(afterSecond.status, "past_due");
        }),
    );

    it.effect("is tolerant of unknown event types (200, no command dispatch)", () =>
      Effect.gen(function* () {
        const apiClient = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* apiClient.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        yield* apiClient.billing.startSubscription({
          params: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });
        const httpClient = yield* HttpClient.HttpClient;

        const res = yield* httpClient.execute(
          HttpClientRequest.post("/webhooks/stripe").pipe(
            HttpClientRequest.setHeader("stripe-signature", FAKE_WEBHOOK_SIGNATURE),
            HttpClientRequest.bodyText(
              encodeWebhookPayload({ eventId: "evt_test_unknown", type: "unknown" }),
            ),
          ),
        );

        deepStrictEqual(res.status, 200);
        const after = yield* apiClient.billing.getCurrentSubscription({ params: { orgId } });
        deepStrictEqual(after.status, "active");
        ok(after.id.length > 0);
      }),
    );
  },
);
