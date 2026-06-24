import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("GET /auth/tokens (integration)", () => {
  const { run } = useServerTestRuntime(["auth.api_tokens", "user.users", "platform.roles"], {
    seedSuperAdminCaller: true,
  });

  it("returns the caller's minted tokens without secrets", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const created = yield* client.authTokens.create({ payload: { label: "ci" } });
        const tokens = yield* client.authTokens.list();
        deepStrictEqual(tokens.length, 1);
        const [first] = tokens;
        ok(first !== undefined);
        deepStrictEqual(first.id, created.id);
        deepStrictEqual(first.label, "ci");
        deepStrictEqual(first.prefix, created.prefix);
        // The summary shape carries no `token` field — secrets never re-surface.
        deepStrictEqual("token" in first, false);
      }),
    );
  });

  it("is empty before any token is minted", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        deepStrictEqual((yield* client.authTokens.list()).length, 0);
      }),
    );
  });
});
