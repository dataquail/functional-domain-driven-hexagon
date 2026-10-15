import { deepStrictEqual, ok } from "node:assert";

import { assertDefined } from "@effect/vitest/utils";
import { QueryBus } from "@effect-server-utils/cqrs";
import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Schema from "effect/Schema";

import { Api } from "@/globals/infrastructure/framework/http/api";
import { FindUsersQuery } from "@/modules/user/queries/find-users.query";
import { describeServer } from "@/test-utils/server-test-runtime";

const basePayload = new UserContract.CreateUserPayload({
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

describeServer("POST /users (integration)", { tables: ["user.users"] }, (it) => {
  it.effect("creates a user and persists it", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(Api);
      const res = yield* client.user.create({ payload: basePayload });
      ok(res.id.length > 0);

      // Verify persistence via the production read seam — the typed query
      // bus (ADR-0006). `QueryBus` is exposed at the test runtime via
      // `Layer.provideMerge` in TestServerLive because it's a public
      // cross-module dispatch surface, not a module-internal port.
      const queryBus = yield* QueryBus;
      const result = yield* queryBus.execute(FindUsersQuery, { page: 1, pageSize: 10 });
      const stored = result.users.find((u) => u.email === basePayload.email);
      assertDefined(stored);
      deepStrictEqual(stored.id, res.id);
    }),
  );

  it.effect("returns 409 UserAlreadyExistsError on duplicate email", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(Api);
      yield* client.user.create({ payload: basePayload });
      const err = yield* Effect.flip(client.user.create({ payload: basePayload }));
      ok(Schema.is(UserContract.UserAlreadyExistsError)(err));
      deepStrictEqual(err.email, basePayload.email);
    }),
  );
});
