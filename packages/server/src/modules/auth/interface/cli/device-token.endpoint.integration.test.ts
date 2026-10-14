import { deepStrictEqual, ok } from "node:assert";

import { AuthContract, CliAuthContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";

import { Api } from "@/globals/infrastructure/framework/http/api.js";
import { describeServer } from "@/test-utils/server-test-runtime.js";

// Drives the full device flow through the real HTTP surface: the fake auth
// middleware supplies the super-admin caller for the browser `approve` step.

describeServer(
  "POST /cli/device/token (integration)",
  {
    tables: ["auth.device_grants", "auth.api_tokens", "user.users", "platform.roles"],
    seedSuperAdminCaller: true,
  },
  (it) => {
    it.effect("returns authorization_pending before approval", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { device_code: deviceCode } = yield* client.cliAuth.deviceStart();

        const error = yield* client.cliAuth
          .deviceToken({
            payload: new CliAuthContract.DeviceTokenPayload({ device_code: deviceCode }),
          })
          .pipe(Effect.flip);

        deepStrictEqual(error._tag, "DeviceAuthorizationPending");
      }),
    );

    it.effect("exchanges an approved grant for a working bearer token, single-use", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { device_code: deviceCode, user_code: userCode } =
          yield* client.cliAuth.deviceStart();

        // Browser approves (fake super-admin caller)…
        yield* client.authDevice.approve({
          payload: new AuthContract.DeviceApprovalPayload({ userCode }),
        });

        // …CLI exchanges the device code for a token.
        const res = yield* client.cliAuth.deviceToken({
          payload: new CliAuthContract.DeviceTokenPayload({ device_code: deviceCode }),
        });

        ok(res.access_token.startsWith("pat_"));
        deepStrictEqual(res.token_type, "Bearer");
        // (That the bearer token authenticates the real middleware is covered
        // by the Phase-A manual E2E; the test server uses the auth fake.)

        // Grant is consumed: a second poll is rejected.
        const error = yield* client.cliAuth
          .deviceToken({
            payload: new CliAuthContract.DeviceTokenPayload({ device_code: deviceCode }),
          })
          .pipe(Effect.flip);

        deepStrictEqual(error._tag, "DeviceCodeNotFound");
      }),
    );

    it.effect("rejects an unknown device code", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const error = yield* client.cliAuth
          .deviceToken({
            payload: new CliAuthContract.DeviceTokenPayload({ device_code: "not-a-real-code" }),
          })
          .pipe(Effect.flip);

        deepStrictEqual(error._tag, "DeviceCodeNotFound");
      }),
    );
  },
);
