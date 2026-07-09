import { describe, it } from "@effect/vitest";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const suite = describe.sequential;

suite("GET /admin/orgs (integration)", () => {
  // Listing all orgs is super-admin-only (organizationPolicies.read =
  // SuperAdminOnly). Super-admins can't create orgs, so seed the orgs to list
  // directly: "Acme" active, "Beta" tombstoned.
  const { run } = useServerTestRuntime(
    ["organization.memberships", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  const seedOrgs = Effect.gen(function* () {
    const db = yield* Database.Database;
    yield* db
      .execute((c) =>
        c.query(sql.unsafe`
          INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
          VALUES
            ('11111111-1111-1111-1111-111111111111', 'Acme', now(), now(), null),
            ('22222222-2222-2222-2222-222222222222', 'Beta', now(), now(), now())
        `),
      )
      .pipe(Effect.orDie);
  });

  it("returns created orgs (active-only by default)", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrgs;
        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.organizationAdmin.findAll({
          query: new OrganizationContract.FindAllOrganizationsParams({ page: 1, pageSize: 10 }),
        });
        deepStrictEqual(res.total, 1);
        deepStrictEqual(res.organizations[0]?.name, "Acme");
      }),
    );
  });

  it("returns tombstoned orgs when includeDeleted=true", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrgs;
        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.organizationAdmin.findAll({
          query: new OrganizationContract.FindAllOrganizationsParams({
            page: 1,
            pageSize: 10,
            includeDeleted: "true",
          }),
        });
        deepStrictEqual(res.total, 2);
      }),
    );
  });
});

const memberSuite = describe.sequential;

memberSuite("GET /admin/orgs (integration, non-super-admin caller)", () => {
  const { run } = useServerTestRuntime(["organization.organizations", "platform.roles"], {
    server: TestServerLiveAsMember,
  });

  it("returns 403 Forbidden", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organizationAdmin.findAll({
            query: new OrganizationContract.FindAllOrganizationsParams({ page: 1, pageSize: 10 }),
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof
              CustomHttpApiError.Forbidden,
          );
        }
      }),
    );
  });
});
