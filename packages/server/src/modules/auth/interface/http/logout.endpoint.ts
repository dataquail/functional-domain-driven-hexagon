import * as cookie from "cookie";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { EnvVars } from "@/common/env-vars.js";
import { RevokeSessionCommand } from "@/modules/auth/commands/revoke-session.command.js";
import { SessionId } from "@/modules/auth/domain/session.id.js";
import { OidcClient } from "@/modules/auth/infrastructure/clients/oidc.client.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";

// Sign out — single round-trip:
//   1. Reads our session cookie inline (no middleware; logout must work even
//      when our session is already gone).
//   2. Revokes the session row if present (idempotent).
//   3. Clears our session cookie.
//   4. Redirects to Zitadel's end_session_endpoint so the SSO cookie is also
//      torn down. Without this, signing back in would silently re-auth.
//   5. Zitadel redirects back to APP_URL (configured in seed).
export const logoutEndpoint = Effect.fn("AuthLive.logout")(function* () {
  const env = yield* EnvVars;
  const codec = yield* CookieCodec;
  const oidc = yield* OidcClient;
  const httpReq = yield* HttpServerRequest.HttpServerRequest;
  const commandBus = yield* CommandBus;

  const cookies = cookie.parse(httpReq.headers.cookie ?? "");
  const raw = cookies[env.SESSION_COOKIE_NAME];
  if (raw !== undefined && raw !== "") {
    const verified = codec.verify(raw);
    if (verified !== null) {
      yield* commandBus.execute(RevokeSessionCommand.make({ sessionId: SessionId.make(verified) }));
    }
  }

  const endSessionUrl = yield* oidc.buildEndSessionUrl().pipe(
    Effect.map((u) => u.toString()),
    // If discovery fails (Zitadel down), fall back to landing on the app
    // root — local logout still completes; the SSO cookie sticks around
    // until next interaction.
    Effect.catch(() => Effect.succeed(env.APP_URL)),
  );

  return HttpServerResponse.empty({ status: 302 }).pipe(
    HttpServerResponse.setHeader("location", endSessionUrl),
    HttpServerResponse.setCookiesUnsafe([
      [
        env.SESSION_COOKIE_NAME,
        "",
        {
          httpOnly: true,
          secure: false, // dev; set true behind TLS
          sameSite: "strict",
          maxAge: 0,
          path: "/",
        },
      ],
    ]),
  );
});
