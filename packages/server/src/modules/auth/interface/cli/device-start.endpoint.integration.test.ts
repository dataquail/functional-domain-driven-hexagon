import { ok } from "node:assert";

import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";

import { Api } from "@/globals/infrastructure/framework/http/api.js";
import { describeServer } from "@/test-utils/server-test-runtime.js";
// Public endpoint — no caller identity needed.

describeServer("POST /cli/device/start (integration)", { tables: ["auth.device_grants"] }, (it) => {
  it.effect("returns device + user codes and a verification URL", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(Api);
      const res = yield* client.cliAuth.deviceStart();
      ok(res.device_code.length > 0);
      ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(res.user_code));
      ok(res.verification_uri.endsWith("/device"));
      ok(res.verification_uri_complete.includes(encodeURIComponent(res.user_code)));
      ok(res.interval > 0);
      ok(res.expires_in > 0);
    }),
  );
});
