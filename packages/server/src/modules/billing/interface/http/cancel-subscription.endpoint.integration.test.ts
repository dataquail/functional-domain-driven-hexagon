import { deepStrictEqual, ok } from "node:assert";

import { BillingContract, OrganizationContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { Api } from "@/globals/infrastructure/framework/http/api";
import { describeServer } from "@/test-utils/server-test-runtime";
import { TestServerLiveAsMember } from "@/test-utils/test-server";

const BILLING_TABLES = [
  "billing.subscriptions",
  "billing.webhook_events",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

describeServer(
  "DELETE /orgs/:orgId/billing/subscriptions/current (integration)",
  { tables: BILLING_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("flips the subscription's status to 'canceled' and returns the canceled view", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        yield* client.billing.startSubscription({
          params: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });
        const res = yield* client.billing.cancelSubscription({ params: { orgId } });
        deepStrictEqual(res.organizationId, orgId);
        deepStrictEqual(res.status, "canceled");

        // GET should now reflect the canceled state.
        const current = yield* client.billing.getCurrentSubscription({ params: { orgId } });
        deepStrictEqual(current.status, "canceled");
      }),
    );

    it.effect(
      "returns 404 SubscriptionNotFoundError when canceling a non-existent subscription",
      () =>
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(Api);

          const { id: orgId } = yield* client.organization.create({
            payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
          });

          const error = yield* Effect.flip(
            client.billing.cancelSubscription({ params: { orgId } }),
          );

          ok(Schema.is(BillingContract.SubscriptionNotFoundError)(error));
        }),
    );
  },
);

// Non-admin caller: `TestServerLiveAsMember` reports `MEMBER_CALLER_ID`, who has
// no `super_admin` platform role and no `admin` org-role on a foreign org.
// Cancelling is `update`-gated like subscribing, so the composed check denies.

describeServer(
  "DELETE /orgs/:orgId/billing/subscriptions/current (non-admin caller)",
  { tables: BILLING_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("returns 403 Forbidden for a caller who isn't an org admin", () =>
      Effect.gen(function* () {
        // Seeded directly: creating the org through the endpoint would
        // auto-grant the caller admin, defeating the test.
        const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
        const sql = yield* Database.Database;
        yield* sql`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${orgId}, 'Acme', now(), now(), null)
            `.pipe(Effect.orDie);

        const client = yield* HttpApiClient.make(Api);
        const error = yield* Effect.flip(client.billing.cancelSubscription({ params: { orgId } }));
        ok(Schema.is(CustomHttpApiError.Forbidden)(error));
      }),
    );
  },
);
