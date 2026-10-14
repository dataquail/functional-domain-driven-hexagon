import { deepStrictEqual, ok } from "node:assert";

import { assertTrue } from "@effect/vitest/utils";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { OrganizationId } from "@org/contracts/EntityIds";
import { Database } from "@org/database/index";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { Api } from "@/globals/infrastructure/framework/http/api";
import { describeServer } from "@/test-utils/server-test-runtime";
import { TestServerLiveAsMember } from "@/test-utils/test-server";

const DeletedAtRow = Schema.Struct({
  deleted_at: Schema.OptionFromNullOr(Schema.DateTimeUtcFromDate),
});

describeServer(
  "DELETE /orgs/:id (integration)",
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
    // Tombstoning an org is super-admin-only (organizationPolicies.delete =
    // SuperAdminOnly), so this suite runs as the default super-admin caller.
    // Super-admins can't create orgs, so the target org is seeded directly.

    const seededOrgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");

    const seedOrg = (id: string, name: string) =>
      Effect.gen(function* () {
        const sql = yield* Database.Database;
        yield* sql`
            INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
            VALUES (${id}, ${name}, now(), now(), null)
          `.pipe(Effect.orDie);
      });

    it.effect("tombstones the org", () =>
      Effect.gen(function* () {
        yield* seedOrg(seededOrgId, "Acme");
        const client = yield* HttpApiClient.make(Api);
        yield* client.organization.softDelete({ params: { id: seededOrgId } });
        const sql = yield* Database.Database;

        const rows = yield* sql`
              SELECT deleted_at FROM "organization".organizations WHERE id = ${seededOrgId}
            `.pipe(Database.rows(DeletedAtRow), Effect.orDie);

        deepStrictEqual(rows.length, 1);
        assertTrue(rows.every((row) => Option.isSome(row.deleted_at)));
      }),
    );

    it.effect("returns 404 OrganizationNotFoundError for unknown id", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const exit = yield* Effect.exit(
          client.organization.softDelete({
            params: { id: OrganizationId.make("00000000-0000-0000-0000-000000000000") },
          }),
        );

        ok(Exit.isFailure(exit));

        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Schema.is(OrganizationContract.OrganizationNotFoundError)(
              Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow),
            ),
          );
        }
      }),
    );
  },
);

describeServer(
  "DELETE /orgs/:id (integration, non-super-admin caller)",
  {
    tables: [
      "organization.memberships",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  },
  (it) => {
    it.effect("returns 403 Forbidden", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const exit = yield* Effect.exit(client.organization.softDelete({ params: { id } }));
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
