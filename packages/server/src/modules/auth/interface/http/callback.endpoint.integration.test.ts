import { describe, it } from "@effect/vitest";
import { AuthContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { ok } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

// The callback happy path (PKCE cookie present → Zitadel code exchange →
// session issued) needs a live Zitadel and is covered end-to-end by Playwright
// (`packages/acceptance/specs/login.spec.ts`) and at the persistence boundary
// by the SessionRepositoryLive integration test. What this file locks down is
// the pre-Zitadel guard the real HTTP layer runs on every callback: a request
// arriving without our signed OIDC state cookie must be rejected with 401
// before any code exchange is attempted. This is the CSRF/replay defense, and
// it's reachable without an IdP because it fails before `OidcClient` is called.
const suite = describe.sequential;

suite("GET /auth/callback (integration)", () => {
  const { run } = useServerTestRuntime(["auth.sessions", "user.users"]);

  it("rejects a callback with no OIDC state cookie as 401 Unauthorized", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        // A Zitadel redirect carries code+state, but with no PKCE cookie on the
        // request the endpoint must refuse before touching the IdP.
        const exit = yield* Effect.exit(
          client.auth.callback({
            query: new AuthContract.CallbackParams({
              code: "authorization-code",
              state: "csrf-state",
            }),
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof
              CustomHttpApiError.Unauthorized,
          );
        }
      }),
    );
  });
});
