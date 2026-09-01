import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import { BillingContract, OrganizationContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database } from "@org/database/index";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/platform/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
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

const suite = describe.sequential;

suite("DELETE /orgs/:orgId/billing/subscriptions/current (integration)", () => {
  const { run } = useServerTestRuntime(BILLING_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("flips the subscription's status to 'canceled' and returns the canceled view", async () => {
    await run(
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
  });

  it("returns 404 SubscriptionNotFoundError when canceling a non-existent subscription", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });
        const exit = yield* Effect.exit(client.billing.cancelSubscription({ params: { orgId } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof
              BillingContract.SubscriptionNotFoundError,
          );
        }
      }),
    );
  });
});

// Non-admin caller: `TestServerLiveAsMember` reports `MEMBER_CALLER_ID`, who has
// no `super_admin` platform role and no `admin` org-role on a foreign org.
// Cancelling is `update`-gated like subscribing, so the composed check denies.
const memberSuite = describe.sequential;

memberSuite("DELETE /orgs/:orgId/billing/subscriptions/current (non-admin caller)", () => {
  const { run } = useServerTestRuntime(BILLING_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("returns 403 Forbidden for a caller who isn't an org admin", async () => {
    await run(
      Effect.gen(function* () {
        // Seeded directly: creating the org through the endpoint would
        // auto-grant the caller admin, defeating the test.
        const orgId = "11111111-1111-1111-1111-111111111111" as never;
        const sql = yield* Database.Database;
        yield* sql`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${orgId}, 'Acme', now(), now(), null)
            `.pipe(Effect.orDie);

        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(client.billing.cancelSubscription({ params: { orgId } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof
              CustomHttpApiError.Forbidden,
          );
        } else {
          throw new Error("expected typed Fail, got " + JSON.stringify(exit));
        }
      }),
    );
  });
});
