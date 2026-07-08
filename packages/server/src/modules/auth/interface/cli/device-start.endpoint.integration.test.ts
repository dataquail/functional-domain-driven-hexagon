import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { ok } from "assert";
import * as Effect from "effect/Effect";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
// Public endpoint — no caller identity needed.
const suite = describe.sequential;

suite("POST /cli/device/start (integration)", () => {
  const { run } = useServerTestRuntime(["auth.device_grants"]);

  it("returns device + user codes and a verification URL", async () => {
    await run(
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
});
