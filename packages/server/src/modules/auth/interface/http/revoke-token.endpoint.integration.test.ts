import { describe, it } from "@effect/vitest";
import { AuthContract } from "@org/contracts/api/Contracts";
import { ApiTokenId } from "@org/contracts/EntityIds";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const suite = describe.sequential;

suite("DELETE /auth/tokens/:id (integration)", () => {
  const { run } = useServerTestRuntime(["auth.api_tokens", "user.users", "platform.roles"], {
    seedSuperAdminCaller: true,
  });

  it("revokes a token so it drops out of the listing", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const created = yield* client.authTokens.create({
          payload: new AuthContract.CreateApiTokenPayload({ label: "ci" }),
        });
        yield* client.authTokens.revoke({ params: { id: created.id } });
        deepStrictEqual((yield* client.authTokens.list()).length, 0);
      }),
    );
  });

  it("a second revoke (now absent) fails 404 NotFound", async () => {
    await run(
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
  });

  it("revoking an unknown id fails 404 NotFound", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const error = yield* client.authTokens
          .revoke({ params: { id: ApiTokenId.make("99999999-9999-9999-9999-999999999999") } })
          .pipe(Effect.flip);
        deepStrictEqual(error._tag, "NotFound");
      }),
    );
  });
});
