import { describe, it } from "@effect/vitest";
import { AuthContract } from "@org/contracts/api/Contracts";
import { ok } from "assert";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

// `TestServerLive` provides the super-admin fake CurrentUser; `seedSuperAdminCaller`
// inserts that user row so the token's user_id FK resolves.
const suite = describe.sequential;

suite("POST /auth/tokens (integration)", () => {
  const { run } = useServerTestRuntime(["auth.api_tokens", "user.users", "platform.roles"], {
    seedSuperAdminCaller: true,
  });

  it("mints a token, returns the plaintext + prefix once, and defaults expiry", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const created = yield* client.authTokens.create({
          payload: new AuthContract.CreateApiTokenPayload({ label: "ci-deploy" }),
        });
        ok(created.token.startsWith("pat_"));
        ok(created.token.startsWith(created.prefix));
        ok(created.prefix.startsWith("pat_"));
        ok(!created.prefix.includes(created.token.slice(created.prefix.length + 1)));
        ok(created.expiresAt !== null);
        ok(typeof created.id === "string" && created.id.length > 0);
      }),
    );
  });

  it("honors an explicit expiresInDays", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const created = yield* client.authTokens.create({
          payload: new AuthContract.CreateApiTokenPayload({ label: "short", expiresInDays: 1 }),
        });
        ok(created.expiresAt !== null);
      }),
    );
  });
});
