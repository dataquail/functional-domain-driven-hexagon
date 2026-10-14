import { deepStrictEqual, ok } from "node:assert";

import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { Api } from "@/globals/infrastructure/framework/http/api.js";
import { describeServer } from "@/test-utils/server-test-runtime.js";

const basePayload = new UserContract.CreateUserPayload({
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

describeServer("DELETE /users/:id (integration)", { tables: ["user.users"] }, (it) => {
  it.effect("removes the user", () =>
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

  it.effect("returns 404 UserNotFoundError for unknown id", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(Api);

      const error = yield* Effect.flip(
        client.user.delete({
          params: { id: UserId.make("00000000-0000-0000-0000-000000000000") },
        }),
      );

      ok(Schema.is(UserContract.UserNotFoundError)(error));
    }),
  );
});
