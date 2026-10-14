import { deepStrictEqual, ok } from "node:assert";

import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database } from "@org/database/index";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { Api } from "@/globals/infrastructure/framework/http/api.ts";
import { describeServer } from "@/test-utils/server-test-runtime.ts";
import { TestServerLiveAsMember } from "@/test-utils/test-server.ts";

describeServer(
  "GET /admin/orgs (integration)",
  {
    tables: [
      "organization.memberships",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    seedSuperAdminCaller: true,
  },
  (it) => {
    // Listing all orgs is super-admin-only (organizationPolicies.read =
    // SuperAdminOnly). Super-admins can't create orgs, so seed the orgs to list
    // directly: "Acme" active, "Beta" tombstoned.

    const seedOrgs = Effect.gen(function* () {
      const sql = yield* Database.Database;
      yield* sql`
          INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
          VALUES
            ('11111111-1111-1111-1111-111111111111', 'Acme', now(), now(), null),
            ('22222222-2222-2222-2222-222222222222', 'Beta', now(), now(), now())
        `.pipe(Effect.orDie);
    });

    it.effect("returns created orgs (active-only by default)", () =>
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

    it.effect("returns tombstoned orgs when includeDeleted=true", () =>
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
  },
);

describeServer(
  "GET /admin/orgs (integration, non-super-admin caller)",
  { tables: ["organization.organizations", "platform.roles"], server: TestServerLiveAsMember },
  (it) => {
    it.effect("returns 403 Forbidden", () =>
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
            Schema.is(CustomHttpApiError.Forbidden)(
              Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow),
            ),
          );
        }
      }),
    );
  },
);
