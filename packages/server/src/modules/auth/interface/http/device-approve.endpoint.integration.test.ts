import { describe, it } from "@effect/vitest";
import { AuthContract, CliAuthContract } from "@org/contracts/api/Contracts";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

// The fake auth middleware supplies the approving super-admin caller.
const suite = describe.sequential;

suite("POST /auth/device/approve (integration)", () => {
  const { run } = useServerTestRuntime(
    ["auth.device_grants", "auth.api_tokens", "user.users", "platform.roles"],
    { seedSuperAdminCaller: true },
  );

  it("approves a pending grant so the CLI can then exchange it", async () => {
    await run(
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
  });

  it("fails 404 for an unknown user code", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const error = yield* client.authDevice
          .approve({ payload: new AuthContract.DeviceApprovalPayload({ userCode: "ZZZZ-9999" }) })
          .pipe(Effect.flip);
        deepStrictEqual(error._tag, "NotFound");
      }),
    );
  });
});
