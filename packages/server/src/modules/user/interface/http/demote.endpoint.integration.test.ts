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

const basePayload = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
};

const RoleRowStd = Schema.standardSchemaV1(Schema.Struct({ role: Schema.String }));

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("DELETE /users/:id/super-admin (integration)", () => {
  const { run } = useServerTestRuntime(["user.users", "platform.roles"], {
    seedSuperAdminCaller: true,
  });

  it("revokes the super_admin role in platform.roles", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.user.create({ payload: basePayload });
        yield* client.user.promoteToSuperAdmin({ path: { id } });
        yield* client.user.demoteFromSuperAdmin({ path: { id } });
        const db = yield* Database.Database;
        const rows = yield* db
          .execute((c) =>
            c.any(sql.type(RoleRowStd)`
              SELECT role FROM platform.roles WHERE user_id = ${id}
            `),
          )
          .pipe(Effect.orDie);
        deepStrictEqual(rows, []);
      }),
    );
  });

  it("returns 404 UserNotFoundError for unknown id", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.user.demoteFromSuperAdmin({
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
});

const memberSuite = hasTestDatabase ? describe.sequential : describe.skip;

memberSuite("DELETE /users/:id/super-admin (integration, non-super-admin caller)", () => {
  const { run } = useServerTestRuntime(["user.users", "platform.roles"], {
    server: TestServerLiveAsMember,
  });

  it("returns 403 Forbidden when the caller is not super admin", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.user.create({ payload: basePayload });
        const exit = yield* Effect.exit(client.user.demoteFromSuperAdmin({ path: { id } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});
