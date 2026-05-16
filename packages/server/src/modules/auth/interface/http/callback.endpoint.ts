import { EnvVars } from "@/common/env-vars.js";
import { SignInCommand } from "@/modules/auth/commands/sign-in-command.js";
import { OidcClient } from "@/modules/auth/infrastructure/oidc-client.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { CommandBus } from "@/platform/command-bus.js";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as cookie from "cookie";
import * as Effect from "effect/Effect";

const PKCE_COOKIE_NAME = "oidc_pkce";

export const callbackEndpoint = () =>
  Effect.gen(function* () {
    const oidc = yield* OidcClient;
    const codec = yield* CookieCodec;
    const env = yield* EnvVars;
    const httpReq = yield* HttpServerRequest.HttpServerRequest;

    const cookies = cookie.parse(httpReq.headers.cookie ?? "");
    const signedPkce = cookies[PKCE_COOKIE_NAME];
    if (signedPkce === undefined || signedPkce === "") {
      return yield* Effect.fail(
        new CustomHttpApiError.Unauthorized({ message: "Missing OIDC state cookie" }),
      );
    }
    const verified = codec.verify(signedPkce);
    if (verified === null) {
      return yield* Effect.fail(
        new CustomHttpApiError.Unauthorized({ message: "Invalid OIDC state cookie" }),
      );
    }
    const { codeVerifier, state: expectedState } = JSON.parse(
      Buffer.from(verified, "base64url").toString("utf8"),
    ) as { state: string; codeVerifier: string };

    // openid-client derives the token-exchange `redirect_uri` from this
    // URL's origin+path, and Zitadel rejects the exchange if it doesn't
    // match the authorize-time value byte-for-byte.
    //
    // We can't reconstruct from `httpReq.url` directly: Next's `/api/*`
    // rewrite strips the `/api` prefix before the request reaches us, so
    // `httpReq.url` is `/auth/callback?…` here, not `/api/auth/callback?…`.
    // Feeding that as the path would yield a URL without `/api` and trip
    // "redirect_uri does not correspond". Use the env-configured redirect
    // URI for origin+path (the authorize step already used this value)
    // and only carry the query string from the inbound request.
    const queryIndex = httpReq.url.indexOf("?");
    const url = new URL(
      env.ZITADEL_REDIRECT_URI + (queryIndex >= 0 ? httpReq.url.slice(queryIndex) : ""),
    );
    const exchange = yield* oidc.exchangeCode(url, expectedState, codeVerifier);

    const bus = yield* CommandBus;
    const { sessionId } = yield* bus.execute(
      SignInCommand.make({
        subject: exchange.subject,
        email: exchange.email,
        ttlSeconds: env.SESSION_TTL_SECONDS,
        absoluteTtlSeconds: env.SESSION_ABSOLUTE_TTL_SECONDS,
      }),
    );
    const sessionCookie = codec.sign(sessionId);

    return HttpServerResponse.empty({ status: 302 }).pipe(
      HttpServerResponse.setHeader("location", env.APP_URL),
      HttpServerResponse.unsafeSetCookies([
        [
          env.SESSION_COOKIE_NAME,
          sessionCookie,
          {
            httpOnly: true,
            secure: false, // dev; set true behind TLS
            sameSite: "strict",
            maxAge: env.SESSION_TTL_SECONDS * 1000,
            path: "/",
          },
        ],
        [
          PKCE_COOKIE_NAME,
          "",
          {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 0,
            // Must match the login endpoint's path (`/`) so the browser
            // accepts the deletion. ADR-0018 § "How the /api/* proxy works".
            path: "/",
          },
        ],
      ]),
    );
  }).pipe(Effect.withSpan("AuthLive.callback"));
