import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { UserContract } from "@org/contracts/api/Contracts";
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

suite("PUT /users/:id/role (integration)", () => {
  const { run } = useServerTestRuntime(["users"]);

  it("promotes the user to admin", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.user.create({ payload: basePayload });
        yield* client.user.changeRole({ path: { id }, payload: { role: "admin" } });
        const res = yield* client.user.find({ urlParams: { page: 1, pageSize: 10 } });
        deepStrictEqual(res.users[0]?.role, "admin");
      }),
    );
  });

  it("returns 404 UserNotFoundError for unknown id", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.user.changeRole({
            path: { id: "00000000-0000-0000-0000-000000000000" as never },
            payload: { role: "admin" },
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
