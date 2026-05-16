import { EnvVars } from "@/common/env-vars.js";
import { SessionId } from "@/modules/auth/domain/session-id.js";
import { SessionRepository } from "@/modules/auth/domain/session-repository.js";
import { OidcClient } from "@/modules/auth/infrastructure/oidc-client.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import * as cookie from "cookie";
import * as Effect from "effect/Effect";

// Sign out — single round-trip:
//   1. Reads our session cookie inline (no middleware; logout must work even
//      when our session is already gone).
//   2. Revokes the session row if present (idempotent).
//   3. Clears our session cookie.
//   4. Redirects to Zitadel's end_session_endpoint so the SSO cookie is also
//      torn down. Without this, signing back in would silently re-auth.
//   5. Zitadel redirects back to APP_URL (configured in seed).
export const logoutEndpoint = () =>
  Effect.gen(function* () {
    const env = yield* EnvVars;
    const codec = yield* CookieCodec;
    const sessions = yield* SessionRepository;
    const oidc = yield* OidcClient;
    const httpReq = yield* HttpServerRequest.HttpServerRequest;

    const cookies = cookie.parse(httpReq.headers.cookie ?? "");
    const raw = cookies[env.SESSION_COOKIE_NAME];
    if (raw !== undefined && raw !== "") {
      const verified = codec.verify(raw);
      if (verified !== null) {
        yield* sessions.revoke(SessionId.make(verified)).pipe(Effect.ignore);
      }
    }

    const endSessionUrl = yield* oidc.buildEndSessionUrl().pipe(
      Effect.map((u) => u.toString()),
      // If discovery fails (Zitadel down), fall back to landing on the app
      // root — local logout still completes; the SSO cookie sticks around
      // until next interaction.
      Effect.catchAll(() => Effect.succeed(env.APP_URL)),
    );

    return HttpServerResponse.empty({ status: 302 }).pipe(
      HttpServerResponse.setHeader("location", endSessionUrl),
      HttpServerResponse.unsafeSetCookies([
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
  }).pipe(Effect.withSpan("AuthLive.logout"));
