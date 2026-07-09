import { describe, it } from "@effect/vitest";
import { UserContract } from "@org/contracts/api/Contracts";
import { deepStrictEqual, ok } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const basePayload = new UserContract.CreateUserPayload({
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const suite = describe.sequential;

suite("DELETE /users/:id (integration)", () => {
  const { run } = useServerTestRuntime(["user.users"]);

  it("removes the user", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.user.create({ payload: basePayload });
        yield* client.user.delete({ params: { id } });
        const after = yield* client.user.find({
          query: new UserContract.FindUsersParams({ page: 1, pageSize: 10 }),
        });
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
            params: { id: "00000000-0000-0000-0000-000000000000" as never },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof
              UserContract.UserNotFoundError,
          );
        } else {
          throw new Error("expected a typed Fail");
        }
      }),
    );
  });
});
