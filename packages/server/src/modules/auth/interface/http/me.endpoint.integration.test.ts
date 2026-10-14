import { deepStrictEqual } from "node:assert";

import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";

import { Api } from "@/globals/infrastructure/framework/http/api.ts";
import { describeServer } from "@/test-utils/server-test-runtime.ts";
// `TestServerLive` provides `UserAuthMiddlewareFake`, which always succeeds
// with a deterministic admin CurrentUser. So `/auth/me` should always return
// that fake identity here — no cookie required, no identity provider involved. The
// real cookie path is exercised by `auth-identity-repository-live` and by
// the Playwright auth-setup project / login.spec.ts.

describeServer(
  "GET /auth/me (integration)",
  { tables: ["user.users", "platform.roles"], seedSuperAdminCaller: true },
  (it) => {
    it.effect("returns the fake admin CurrentUser", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const me = yield* client.authSession.me();
        deepStrictEqual(me.userId, "00000000-0000-0000-0000-000000000001");
        deepStrictEqual(me.isSuperAdmin, true);
      }),
    );
  },
);
