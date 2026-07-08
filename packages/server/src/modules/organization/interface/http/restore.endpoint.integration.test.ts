import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database, sql } from "@org/database/index";
import { ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const DeletedAtRowStd = Schema.toStandardSchemaV1(
  Schema.Struct({ deleted_at: Schema.NullOr(Schema.DateTimeUtcFromDate) }),
);

const suite = describe.sequential;

suite("POST /orgs/:id/restore (integration)", () => {
  // Restore is super-admin-or-org-admin; this suite runs as the super-admin
  // caller. Super-admins can't create orgs, so target orgs are seeded directly.
  const { run } = useServerTestRuntime(
    ["organization.memberships", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  const orgId = "11111111-1111-1111-1111-111111111111" as never;
  const seedOrg = (deleted: boolean) =>
    Effect.gen(function* () {
      const db = yield* Database.Database;
      yield* db
        .execute((c) =>
          c.query(
            deleted
              ? sql.unsafe`
                  INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
                  VALUES (${orgId}, 'Acme', now(), now(), now())
                `
              : sql.unsafe`
                  INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
                  VALUES (${orgId}, 'Acme', now(), now(), null)
                `,
          ),
        )
        .pipe(Effect.orDie);
    });

  it("clears the tombstone", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg(true);
        const client = yield* HttpApiClient.make(Api);
        yield* client.organization.restore({ params: { id: orgId } });
        const db = yield* Database.Database;
        const rows = yield* db
          .execute((c) =>
            c.any(sql.type(DeletedAtRowStd)`
              SELECT deleted_at FROM "organization".organizations WHERE id = ${orgId}
            `),
          )
          .pipe(Effect.orDie);
        ok(rows[0]?.deleted_at === null);
      }),
    );
  });

  it("returns 409 OrganizationNotDeletedError when restoring an active org", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg(false);
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(client.organization.restore({ params: { id: orgId } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof OrganizationContract.OrganizationNotDeletedError);
        }
      }),
    );
  });

  it("returns 404 OrganizationNotFoundError for unknown id", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.restore({
            params: { id: "00000000-0000-0000-0000-000000000000" as never },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof OrganizationContract.OrganizationNotFoundError);
        }
      }),
    );
  });
});

const memberSuite = describe.sequential;

memberSuite("POST /orgs/:id/restore (integration, non-super-admin caller)", () => {
  const { run } = useServerTestRuntime(
    ["organization.memberships", "organization.organizations", "platform.roles", "user.users"],
    { server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  );

  // Seeds an org directly via SQL so the member-caller is NOT an admin
  // of it — `restore`'s policy is `any(SuperAdminOnly, IsOrgAdmin)`, so
  // the 403 path requires both halves to fail.
  it("returns 403 Forbidden for a caller who's neither a super-admin nor an org admin", async () => {
    await run(
      Effect.gen(function* () {
        const orgId = "11111111-1111-1111-1111-111111111111" as never;
        const db = yield* Database.Database;
        yield* db
          .execute((c) =>
            c.query(sql.unsafe`
              INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
              VALUES (${orgId}, 'Acme', now(), now(), now())
            `),
          )
          .pipe(Effect.orDie);
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(client.organization.restore({ params: { id: orgId } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});
