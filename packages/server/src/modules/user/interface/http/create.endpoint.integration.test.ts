import { describe, it } from "@effect/vitest";
import { UserContract } from "@org/contracts/api/Contracts";
import { deepStrictEqual, ok } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/api.js";
import { FindUsersQuery } from "@/modules/user/index.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const basePayload = new UserContract.CreateUserPayload({
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const suite = describe.sequential;

suite("POST /users (integration)", () => {
  const { run } = useServerTestRuntime(["user.users"]);

  it("creates a user and persists it", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.user.create({ payload: basePayload });
        ok(typeof res.id === "string" && res.id.length > 0);

        // Verify persistence via the production read seam — the typed query
        // bus (ADR-0006). `QueryBus` is exposed at the test runtime via
        // `Layer.provideMerge` in TestServerLive because it's a public
        // cross-module dispatch surface, not a module-internal port.
        const queryBus = yield* QueryBus;
        const result = yield* queryBus.execute(FindUsersQuery.make({ page: 1, pageSize: 10 }));
        const stored = result.users.find((u) => u.email === basePayload.email);
        ok(stored !== undefined);
        deepStrictEqual(stored.id, res.id);
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
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          const err = Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow);
          ok(err instanceof UserContract.UserAlreadyExistsError);
          deepStrictEqual(err.email, basePayload.email);
        } else {
          throw new Error("expected a typed Fail, got " + JSON.stringify(exit));
        }
      }),
    );
  });
});
