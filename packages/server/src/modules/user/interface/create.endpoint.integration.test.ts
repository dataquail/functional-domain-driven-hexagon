import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { UserContract } from "@org/contracts/api/Contracts";
import { Database, RowSchemas, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

const basePayload = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
};

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("POST /users (integration)", () => {
  const { run } = useServerTestRuntime(["users"]);

  it("creates a user and persists it", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.user.create({ payload: basePayload });
        ok(typeof res.id === "string" && res.id.length > 0);

        const db = yield* Database.Database;
        const rows = yield* db.execute((c) =>
          c.any(sql.type(RowSchemas.UserRowStd)`
            SELECT * FROM users WHERE email = ${basePayload.email}
          `),
        );
        deepStrictEqual(rows.length, 1);
        deepStrictEqual(rows[0]?.role, "guest");
      }),
    );
  });

  it("returns 409 UserAlreadyExistsError on duplicate email", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        yield* client.user.create({ payload: basePayload });
        const exit = yield* Effect.exit(client.user.create({ payload: basePayload }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          const err = exit.cause.error;
          ok(err instanceof UserContract.UserAlreadyExistsError);
          deepStrictEqual(err.email, basePayload.email);
        } else {
          throw new Error("expected a typed Fail, got " + JSON.stringify(exit));
        }
      }),
    );
  });
});
