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

suite("DELETE /users/:id (integration)", () => {
  const { run } = useServerTestRuntime(["users"]);

  it("removes the user", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.user.create({ payload: basePayload });
        yield* client.user.delete({ path: { id } });
        const after = yield* client.user.find({ urlParams: { page: 1, pageSize: 10 } });
        deepStrictEqual(after.total, 0);
      }),
    );
  });

  it("returns 404 UserNotFoundError for unknown id", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.user.delete({
            path: { id: "00000000-0000-0000-0000-000000000000" as never },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof UserContract.UserNotFoundError);
        } else {
          throw new Error("expected a typed Fail");
        }
      }),
    );
  });
});
