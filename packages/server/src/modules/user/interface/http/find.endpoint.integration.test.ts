import { deepStrictEqual } from "node:assert";

import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";

import { Api } from "@/globals/infrastructure/framework/http/api.js";
import { describeServer } from "@/test-utils/server-test-runtime.js";

const basePayload = new UserContract.CreateUserPayload({
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

describeServer("GET /users (integration)", { tables: ["user.users"] }, (it) => {
  it.effect("returns a paginated list after creates", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(Api);
      yield* client.user.create({ payload: basePayload });
      yield* client.user.create({
        payload: new UserContract.CreateUserPayload({ ...basePayload, email: "bob@example.com" }),
      });

      const res = yield* client.user.find({
        query: new UserContract.FindUsersParams({ page: 1, pageSize: 10 }),
      });

      deepStrictEqual(res.page, 1);
      deepStrictEqual(res.pageSize, 10);
      deepStrictEqual(res.total, 2);
      deepStrictEqual(res.users.length, 2);
      const emails = res.users.map((u) => u.email).sort();
      deepStrictEqual(emails, ["alice@example.com", "bob@example.com"]);
    }),
  );
});
