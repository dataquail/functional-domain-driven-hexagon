import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { BillingContract } from "@org/contracts/api/Contracts";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { Api } from "@/api.js";
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
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        yield* client.billing.startSubscription({
          path: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });
        const res = yield* client.billing.cancelSubscription({ path: { orgId } });
        deepStrictEqual(res.organizationId, orgId);
        deepStrictEqual(res.status, "canceled");

        // GET should now reflect the canceled state.
        const current = yield* client.billing.getCurrentSubscription({ path: { orgId } });
        deepStrictEqual(current.status, "canceled");
      }),
    );
  });

  it("returns 404 SubscriptionNotFoundError when canceling a non-existent subscription", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        const exit = yield* Effect.exit(client.billing.cancelSubscription({ path: { orgId } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof BillingContract.SubscriptionNotFoundError);
        }
      }),
    );
  });
});
