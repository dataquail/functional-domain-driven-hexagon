import { deepStrictEqual, ok } from "node:assert";

import { BillingContract, OrganizationContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { Api } from "@/globals/infrastructure/framework/http/api.ts";
import { describeServer } from "@/test-utils/server-test-runtime.ts";
import { TestServerLiveAsMember } from "@/test-utils/test-server.ts";

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
  "POST /orgs/:orgId/billing/subscriptions (integration)",
  { tables: BILLING_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("subscribes an org and returns the created subscription view", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const res = yield* client.billing.startSubscription({
          params: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });

        deepStrictEqual(res.organizationId, orgId);
        deepStrictEqual(res.status, "active");
        ok(res.id.length > 0);
      }),
    );

    it.effect(
      "returns 409 SubscriptionAlreadyExistsError on a second subscribe for the same org",
      () =>
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(Api);

          const { id: orgId } = yield* client.organization.create({
            payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
          });

          yield* client.billing.startSubscription({
            params: { orgId },
            payload: new BillingContract.StartSubscriptionPayload(),
          });

          const error = yield* Effect.flip(
            client.billing.startSubscription({
              params: { orgId },
              payload: new BillingContract.StartSubscriptionPayload(),
            }),
          );

          ok(Schema.is(BillingContract.SubscriptionAlreadyExistsError)(error));
        }),
    );
  },
);

// Non-admin caller: `TestServerLiveAsMember` reports `MEMBER_CALLER_ID`
// as the CurrentUser. That user has no `super_admin` platform role and
// no `admin` org-role on a foreign org — composed check returns false,
// endpoint surfaces `Forbidden`.

describeServer(
  "POST /orgs/:orgId/billing/subscriptions (non-admin caller)",
  { tables: BILLING_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("returns 403 Forbidden for a caller who isn't an org admin", () =>
      Effect.gen(function* () {
        const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
        // Seed the org directly — going through the create endpoint as
        // the member caller would auto-grant them admin (creator becomes
        // admin per Phase 4), defeating the test.
        const sql = yield* Database.Database;
        yield* sql`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${orgId}, 'Acme', now(), now(), null)
            `.pipe(Effect.orDie);

        const client = yield* HttpApiClient.make(Api);

        const error = yield* Effect.flip(
          client.billing.startSubscription({
            params: { orgId },
            payload: new BillingContract.StartSubscriptionPayload(),
          }),
        );

        ok(Schema.is(CustomHttpApiError.Forbidden)(error));
      }),
    );
  },
);
