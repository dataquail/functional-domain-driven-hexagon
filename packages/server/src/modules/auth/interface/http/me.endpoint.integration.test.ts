import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

// `TestServerLive` provides `UserAuthMiddlewareFake`, which always succeeds
// with a deterministic admin CurrentUser. So `/auth/me` should always return
// that fake identity here — no cookie required, no Zitadel involved. The
// real cookie path is exercised by `auth-identity-repository-live` and by
// the Playwright auth-setup project / login.spec.ts.
const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("GET /auth/me (integration)", () => {
  const { run } = useServerTestRuntime([]);

  it("returns the fake admin CurrentUser", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const me = yield* client.authSession.me();
        deepStrictEqual(me.userId, "00000000-0000-0000-0000-000000000001");
        deepStrictEqual(me.permissions.includes("__test:read"), true);
        deepStrictEqual(me.permissions.includes("__test:manage"), true);
        deepStrictEqual(me.permissions.includes("__test:delete"), true);
      }),
    );
  });
});
