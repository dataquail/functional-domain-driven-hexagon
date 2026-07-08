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

suite("POST /orgs/:orgId/billing/subscriptions (integration)", () => {
  // The super-admin caller bypasses `IsBillingOrgAdmin` via the
  // `SuperAdminOnly` half of the composed check. Creates an org via
  // the public endpoint (so the FK + creator-admin row both exist),
  // then subscribes.
  const { run } = useServerTestRuntime(BILLING_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("subscribes an org and returns the created subscription view", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        const res = yield* client.billing.startSubscription({
          path: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });
        deepStrictEqual(res.organizationId, orgId);
        deepStrictEqual(res.status, "active");
        ok(res.id.length > 0);
      }),
    );
  });

  it("returns 409 SubscriptionAlreadyExistsError on a second subscribe for the same org", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        yield* client.billing.startSubscription({
          path: { orgId },
          payload: new BillingContract.StartSubscriptionPayload(),
        });
        const exit = yield* Effect.exit(
          client.billing.startSubscription({
            path: { orgId },
            payload: new BillingContract.StartSubscriptionPayload(),
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof BillingContract.SubscriptionAlreadyExistsError);
        }
      }),
    );
  });
});

// Non-admin caller: `TestServerLiveAsMember` reports `MEMBER_CALLER_ID`
// as the CurrentUser. That user has no `super_admin` platform role and
// no `admin` org-role on a foreign org — composed check returns false,
// endpoint surfaces `Forbidden`.
const memberSuite = describe.sequential;

memberSuite("POST /orgs/:orgId/billing/subscriptions (non-admin caller)", () => {
  const { run } = useServerTestRuntime(BILLING_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("returns 403 Forbidden for a caller who isn't an org admin", async () => {
    await run(
      Effect.gen(function* () {
        const orgId = "11111111-1111-1111-1111-111111111111" as never;
        // Seed the org directly — going through the create endpoint as
        // the member caller would auto-grant them admin (creator becomes
        // admin per Phase 4), defeating the test.
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
        const exit = yield* Effect.exit(
          client.billing.startSubscription({
            path: { orgId },
            payload: new BillingContract.StartSubscriptionPayload(),
          }),
        );
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
