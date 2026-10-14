import { deepStrictEqual, ok } from "node:assert";

import { BillingContract, OrganizationContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { Api } from "@/globals/infrastructure/framework/http/api.js";
import { describeServer } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

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
  "GET /orgs/:orgId/billing/subscriptions/current (integration)",
  { tables: BILLING_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("returns the subscription view after subscribing", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        yield* client.billing.startSubscription({
          params: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });
        const res = yield* client.billing.getCurrentSubscription({ params: { orgId } });
        deepStrictEqual(res.organizationId, orgId);
        deepStrictEqual(res.status, "active");
      }),
    );

    it.effect("returns 404 SubscriptionNotFoundError when no subscription exists for the org", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const error = yield* Effect.flip(
          client.billing.getCurrentSubscription({ params: { orgId } }),
        );

        ok(Schema.is(BillingContract.SubscriptionNotFoundError)(error));
      }),
    );
  },
);

describeServer(
  "GET /orgs/:orgId/billing/subscriptions/current (non-member caller)",
  { tables: BILLING_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("returns 403 Forbidden for a caller who isn't a member of the org", () =>
      Effect.gen(function* () {
        const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
        const sql = yield* Database.Database;
        yield* sql`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${orgId}, 'Acme', now(), now(), null)
            `.pipe(Effect.orDie);

        const client = yield* HttpApiClient.make(Api);

        const error = yield* Effect.flip(
          client.billing.getCurrentSubscription({ params: { orgId } }),
        );

        ok(Schema.is(CustomHttpApiError.Forbidden)(error));
      }),
    );
  },
);
