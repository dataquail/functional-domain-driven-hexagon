import { ok } from "node:assert";

import { assertTrue } from "@effect/vitest/utils";
import { AuthContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Option from "effect/Option";

import { Api } from "@/globals/infrastructure/framework/http/api.js";
import { describeServer } from "@/test-utils/server-test-runtime.js";

// `TestServerLive` provides the super-admin fake CurrentUser; `seedSuperAdminCaller`
// inserts that user row so the token's user_id FK resolves.

describeServer(
  "POST /auth/tokens (integration)",
  { tables: ["auth.api_tokens", "user.users", "platform.roles"], seedSuperAdminCaller: true },
  (it) => {
    it.effect("mints a token, returns the plaintext + prefix once, and defaults expiry", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const created = yield* client.authTokens.create({
          payload: new AuthContract.CreateApiTokenPayload({ label: "ci-deploy" }),
        });

        ok(created.token.startsWith("pat_"));
        ok(created.token.startsWith(created.prefix));
        ok(created.prefix.startsWith("pat_"));
        ok(!created.prefix.includes(created.token.slice(created.prefix.length + 1)));
        assertTrue(Option.isSome(Option.fromNullOr(created.expiresAt)));
        ok(created.id.length > 0);
      }),
    );

    it.effect("honors an explicit expiresInDays", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const created = yield* client.authTokens.create({
          payload: new AuthContract.CreateApiTokenPayload({ label: "short", expiresInDays: 1 }),
        });

        assertTrue(Option.isSome(Option.fromNullOr(created.expiresAt)));
      }),
    );
  },
);
