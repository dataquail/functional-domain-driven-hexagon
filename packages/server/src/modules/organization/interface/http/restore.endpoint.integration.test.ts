import { deepStrictEqual, ok } from "node:assert";

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
  "POST /orgs/:id/restore (integration)",
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
    // Restore is super-admin-or-org-admin; this suite runs as the super-admin
    // caller. Super-admins can't create orgs, so target orgs are seeded directly.

    const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");

    const seedOrg = (deleted: boolean) =>
      Effect.gen(function* () {
        const sql = yield* Database.Database;
        yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${orgId}, 'Acme', now(), now(), NULL)
      `.pipe(Effect.orDie);

        if (deleted) {
          yield* sql`
            UPDATE "organization".organizations SET deleted_at = now() WHERE id = ${orgId}
          `.pipe(Effect.orDie);
        }
      });

    it.effect("clears the tombstone", () =>
      Effect.gen(function* () {
        yield* seedOrg(true);
        const client = yield* HttpApiClient.make(Api);
        yield* client.organization.restore({ params: { id: orgId } });
        const sql = yield* Database.Database;

        const rows = yield* sql`
              SELECT deleted_at FROM "organization".organizations WHERE id = ${orgId}
        `.pipe(Database.rows(DeletedAtRow), Effect.orDie);

        deepStrictEqual(
          rows.map((row) => row.deleted_at),
          [Option.none()],
        );
      }),
    );

    it.effect("returns 409 OrganizationNotDeletedError when restoring an active org", () =>
      Effect.gen(function* () {
        yield* seedOrg(false);
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(client.organization.restore({ params: { id: orgId } }));
        ok(Exit.isFailure(exit));

        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Schema.is(OrganizationContract.OrganizationNotDeletedError)(
              Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow),
            ),
          );
        }
      }),
    );

    it.effect("returns 404 OrganizationNotFoundError for unknown id", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const exit = yield* Effect.exit(
          client.organization.restore({
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
  "POST /orgs/:id/restore (integration, non-super-admin caller)",
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
    // Seeds an org directly via SQL so the member-caller is NOT an admin
    // of it — `restore`'s policy is `any(SuperAdminOnly, IsOrgAdmin)`, so
    // the 403 path requires both halves to fail.
    it.effect(
      "returns 403 Forbidden for a caller who's neither a super-admin nor an org admin",
      () =>
        Effect.gen(function* () {
          const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
          const sql = yield* Database.Database;
          yield* sql`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${orgId}, 'Acme', now(), now(), now())
            `.pipe(Effect.orDie);
          const client = yield* HttpApiClient.make(Api);
          const exit = yield* Effect.exit(client.organization.restore({ params: { id: orgId } }));
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
