import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import * as Effect from "effect/Effect";

import { OidcClient } from "@/modules/auth/infrastructure/oidc-client.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";

import { encodePkcePayload, PKCE_COOKIE_MAX_AGE_MS, PKCE_COOKIE_NAME } from "./oidc-pkce-cookie.js";

export const loginEndpoint = () =>
  Effect.gen(function* () {
    const oidc = yield* OidcClient;
    const codec = yield* CookieCodec;

    const { codeVerifier, state, url } = yield* oidc.buildAuthorize();

    // Pack state+verifier into a signed cookie. Must be SameSite=Lax so the
    // browser sends it on Zitadel's cross-site redirect back to the callback.
    //
    // `path: "/"` (rather than `/auth`) so the cookie rides through Next's
    // `/api/*` rewrite (ADR-0018) — the browser sees the callback at
    // `/api/auth/callback`, not `/auth/callback`, so a `/auth`-scoped cookie
    // would be filtered out before the proxied request leaves the browser.
    // The PKCE cookie is short-lived (5min), HttpOnly, and SameSite=Lax —
    // the broader scope is fine.
    const signed = codec.sign(encodePkcePayload({ state, codeVerifier }));

    return HttpServerResponse.empty({ status: 302 }).pipe(
      HttpServerResponse.setHeader("location", url.toString()),
      HttpServerResponse.unsafeSetCookies([
        [
          PKCE_COOKIE_NAME,
          signed,
          {
            httpOnly: true,
            secure: false, // dev; set true behind TLS
            sameSite: "lax",
            maxAge: PKCE_COOKIE_MAX_AGE_MS,
            path: "/",
          },
        ],
      ]),
    );
  }).pipe(Effect.withSpan("AuthLive.login"));
