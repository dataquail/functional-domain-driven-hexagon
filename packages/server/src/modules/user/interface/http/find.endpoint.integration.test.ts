import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const basePayload = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
};

const suite = describe.sequential;

suite("GET /users (integration)", () => {
  const { run } = useServerTestRuntime(["user.users"]);

  it("returns a paginated list after creates", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        yield* client.user.create({ payload: basePayload });
        yield* client.user.create({ payload: { ...basePayload, email: "bob@example.com" } });
        const res = yield* client.user.find({ query: { page: 1, pageSize: 10 } });
        deepStrictEqual(res.page, 1);
        deepStrictEqual(res.pageSize, 10);
        deepStrictEqual(res.total, 2);
        deepStrictEqual(res.users.length, 2);
        const emails = res.users.map((u) => u.email).sort();
        deepStrictEqual(emails, ["alice@example.com", "bob@example.com"]);
      }),
    );
  });
});
