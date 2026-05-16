import { OidcClient } from "@/modules/auth/infrastructure/oidc-client.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import * as Effect from "effect/Effect";

const PKCE_COOKIE_NAME = "oidc_pkce";

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
    const payload = Buffer.from(JSON.stringify({ state, codeVerifier })).toString("base64url");
    const signed = codec.sign(payload);

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
            maxAge: 300_000,
            path: "/",
          },
        ],
      ]),
    );
  }).pipe(Effect.withSpan("AuthLive.login"));
