import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { UserContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

// Mirrors the deterministic id baked into `UserAuthMiddlewareFake`, so a
// pre-seeded super-admin row in the DB lines up with what `CurrentUser`
// reports during the test.
const SUPER_ADMIN_CALLER_ID = "00000000-0000-0000-0000-000000000001";

const basePayload = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
};

const RoleRowStd = Schema.standardSchemaV1(Schema.Struct({ role: Schema.String }));

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("POST /users/:id/super-admin (integration)", () => {
  const { run } = useServerTestRuntime(["user.users", "platform.roles"], {
    seedSuperAdminCaller: true,
  });

  it("grants the super_admin role in platform.roles", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.user.create({ payload: basePayload });
        yield* client.user.promoteToSuperAdmin({ path: { id } });
        const db = yield* Database.Database;
        const rows = yield* db
          .execute((c) =>
            c.any(sql.type(RoleRowStd)`
              SELECT role FROM platform.roles WHERE user_id = ${id}
            `),
          )
          .pipe(Effect.orDie);
        deepStrictEqual(
          rows.map((r) => r.role),
          ["super_admin"],
        );
      }),
    );
  });

  it("returns 404 UserNotFoundError for unknown id", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.user.promoteToSuperAdmin({
            path: { id: "00000000-0000-0000-0000-000000000000" as never },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof UserContract.UserNotFoundError);
        }
      }),
    );
  });

  // Domain-rule check at the wire: even though the super-admin caller's
  // policy lookup allows a `user.update` on themselves, the GrantRole
  // command rejects self-grants. The endpoint translates that to 403
  // Forbidden. The super-admin caller row is pre-seeded by
  // `seedSuperAdminCaller`, so the resource resolver finds the target.
  it("returns 403 Forbidden when the super-admin caller targets themselves", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.user.promoteToSuperAdmin({ path: { id: SUPER_ADMIN_CALLER_ID as never } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});

// Second suite uses the non-super-admin runtime variant so the Authz
// layer's policy check rejects the call with 403 Forbidden before any
// command dispatch happens. Existing callers stay on the super-admin
// `TestServerLive`; this suite opts in via the `server` override.
const memberSuite = hasTestDatabase ? describe.sequential : describe.skip;

memberSuite("POST /users/:id/super-admin (integration, non-super-admin caller)", () => {
  const { run } = useServerTestRuntime(["user.users", "platform.roles"], {
    server: TestServerLiveAsMember,
  });

  it("returns 403 Forbidden when the caller is not super admin", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.user.create({ payload: basePayload });
        const exit = yield* Effect.exit(client.user.promoteToSuperAdmin({ path: { id } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});
