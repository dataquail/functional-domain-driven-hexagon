import { deepStrictEqual } from "node:assert";

import { assertDefined } from "@effect/vitest/utils";
import { AuthContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";

import { Api } from "@/globals/infrastructure/framework/http/api";
import { describeServer } from "@/test-utils/server-test-runtime";

describeServer(
  "GET /auth/tokens (integration)",
  { tables: ["auth.api_tokens", "user.users", "platform.roles"], seedSuperAdminCaller: true },
  (it) => {
    it.effect("returns the caller's minted tokens without secrets", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const created = yield* client.authTokens.create({
          payload: new AuthContract.CreateApiTokenPayload({ label: "ci" }),
        });

        const tokens = yield* client.authTokens.list();
        deepStrictEqual(tokens.length, 1);
        const [first] = tokens;
        assertDefined(first);
        deepStrictEqual(first.id, created.id);
        deepStrictEqual(first.label, "ci");
        deepStrictEqual(first.prefix, created.prefix);
        // The summary shape carries no `token` field — secrets never re-surface.
        deepStrictEqual("token" in first, false);
      }),
    );

    it.effect("is empty before any token is minted", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        deepStrictEqual((yield* client.authTokens.list()).length, 0);
      }),
    );
  },
);
