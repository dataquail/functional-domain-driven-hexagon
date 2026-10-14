import { deepStrictEqual, ok } from "node:assert";

import { AuthContract, CliAuthContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";

import { Api } from "@/globals/infrastructure/framework/http/api.ts";
import { describeServer } from "@/test-utils/server-test-runtime.ts";

// The fake auth middleware supplies the approving super-admin caller.

describeServer(
  "POST /auth/device/approve (integration)",
  {
    tables: ["auth.device_grants", "auth.api_tokens", "user.users", "platform.roles"],
    seedSuperAdminCaller: true,
  },
  (it) => {
    it.effect("approves a pending grant so the CLI can then exchange it", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { device_code: deviceCode, user_code: userCode } =
          yield* client.cliAuth.deviceStart();

        yield* client.authDevice.approve({
          payload: new AuthContract.DeviceApprovalPayload({ userCode }),
        });

        // Approval took effect: the exchange now succeeds.
        const res = yield* client.cliAuth.deviceToken({
          payload: new CliAuthContract.DeviceTokenPayload({ device_code: deviceCode }),
        });

        ok(res.access_token.startsWith("pat_"));
      }),
    );

    it.effect("fails 404 for an unknown user code", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const error = yield* client.authDevice
          .approve({ payload: new AuthContract.DeviceApprovalPayload({ userCode: "ZZZZ-9999" }) })
          .pipe(Effect.flip);

        deepStrictEqual(error._tag, "NotFound");
      }),
    );
  },
);
