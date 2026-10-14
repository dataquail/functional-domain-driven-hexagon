import { deepStrictEqual } from "node:assert";

import { AuthContract } from "@org/contracts/api/Contracts";
import { ApiTokenId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";

import { Api } from "@/globals/infrastructure/framework/http/api.ts";
import { describeServer } from "@/test-utils/server-test-runtime.ts";

describeServer(
  "DELETE /auth/tokens/:id (integration)",
  { tables: ["auth.api_tokens", "user.users", "platform.roles"], seedSuperAdminCaller: true },
  (it) => {
    it.effect("revokes a token so it drops out of the listing", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const created = yield* client.authTokens.create({
          payload: new AuthContract.CreateApiTokenPayload({ label: "ci" }),
        });

        yield* client.authTokens.revoke({ params: { id: created.id } });
        deepStrictEqual((yield* client.authTokens.list()).length, 0);
      }),
    );

    it.effect("a second revoke (now absent) fails 404 NotFound", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const created = yield* client.authTokens.create({
          payload: new AuthContract.CreateApiTokenPayload({ label: "ci" }),
        });

        yield* client.authTokens.revoke({ params: { id: created.id } });

        const error = yield* client.authTokens
          .revoke({ params: { id: created.id } })
          .pipe(Effect.flip);

        deepStrictEqual(error._tag, "NotFound");
      }),
    );

    it.effect("revoking an unknown id fails 404 NotFound", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const error = yield* client.authTokens
          .revoke({ params: { id: ApiTokenId.make("99999999-9999-9999-9999-999999999999") } })
          .pipe(Effect.flip);

        deepStrictEqual(error._tag, "NotFound");
      }),
    );
  },
);
