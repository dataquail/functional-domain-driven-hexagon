import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";

// Drives the full device flow through the real HTTP surface: the fake auth
// middleware supplies the super-admin caller for the browser `approve` step.
const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("POST /cli/device/token (integration)", () => {
  const { run } = useServerTestRuntime(
    ["auth.device_grants", "auth.api_tokens", "user.users", "platform.roles"],
    { seedSuperAdminCaller: true },
  );

  it("returns authorization_pending before approval", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { device_code: deviceCode } = yield* client.cliAuth.deviceStart();
        const error = yield* client.cliAuth
          .deviceToken({ payload: { device_code: deviceCode } })
          .pipe(Effect.flip);
        deepStrictEqual(error._tag, "DeviceAuthorizationPending");
      }),
    );
  });

  it("exchanges an approved grant for a working bearer token, single-use", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { device_code: deviceCode, user_code: userCode } =
          yield* client.cliAuth.deviceStart();
        // Browser approves (fake super-admin caller)…
        yield* client.authDevice.approve({ payload: { userCode } });
        // …CLI exchanges the device code for a token.
        const res = yield* client.cliAuth.deviceToken({ payload: { device_code: deviceCode } });
        ok(res.access_token.startsWith("pat_"));
        deepStrictEqual(res.token_type, "Bearer");
        // (That the bearer token authenticates the real middleware is covered
        // by the Phase-A manual E2E; the test server uses the auth fake.)

        // Grant is consumed: a second poll is rejected.
        const error = yield* client.cliAuth
          .deviceToken({ payload: { device_code: deviceCode } })
          .pipe(Effect.flip);
        deepStrictEqual(error._tag, "DeviceCodeNotFound");
      }),
    );
  });

  it("rejects an unknown device code", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const error = yield* client.cliAuth
          .deviceToken({ payload: { device_code: "not-a-real-code" } })
          .pipe(Effect.flip);
        deepStrictEqual(error._tag, "DeviceCodeNotFound");
      }),
    );
  });
});
