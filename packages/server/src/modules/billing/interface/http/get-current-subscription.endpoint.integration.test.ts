import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { BillingContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
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

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("GET /orgs/:orgId/billing/subscriptions/current (integration)", () => {
  const { run } = useServerTestRuntime(BILLING_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("returns the subscription view after subscribing", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        yield* client.billing.startSubscription({
          path: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });
        const res = yield* client.billing.getCurrentSubscription({ path: { orgId } });
        deepStrictEqual(res.organizationId, orgId);
        deepStrictEqual(res.status, "active");
      }),
    );
  });

  it("returns 404 SubscriptionNotFoundError when no subscription exists for the org", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        const exit = yield* Effect.exit(client.billing.getCurrentSubscription({ path: { orgId } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof BillingContract.SubscriptionNotFoundError);
        }
      }),
    );
  });
});

const memberSuite = hasTestDatabase ? describe.sequential : describe.skip;

memberSuite("GET /orgs/:orgId/billing/subscriptions/current (non-member caller)", () => {
  const { run } = useServerTestRuntime(BILLING_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("returns 403 Forbidden for a caller who isn't a member of the org", async () => {
    await run(
      Effect.gen(function* () {
        const orgId = "11111111-1111-1111-1111-111111111111" as never;
        const db = yield* Database.Database;
        yield* db
          .execute((c) =>
            c.query(sql.unsafe`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${orgId}, 'Acme', now(), now(), null)
            `),
          )
          .pipe(Effect.orDie);

        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(client.billing.getCurrentSubscription({ path: { orgId } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof CustomHttpApiError.Forbidden);
        } else {
          throw new Error("expected typed Fail, got " + JSON.stringify(exit));
        }
      }),
    );
  });
});
