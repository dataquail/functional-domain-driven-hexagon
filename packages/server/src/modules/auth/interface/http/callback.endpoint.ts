import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as cookie from "cookie";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { EnvVars } from "@/common/env-vars.js";
import { SignInCommand } from "@/modules/auth/commands/sign-in.command.js";
import { OidcClient } from "@/modules/auth/infrastructure/clients/oidc.client.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

import { buildCallbackUrl } from "./callback-url.util.js";
import { decodePkcePayload, PKCE_COOKIE_NAME } from "./oidc-pkce-cookie.util.js";

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
    const payload = decodePkcePayload(verified);
    if (payload === null) {
      return yield* Effect.fail(
        new CustomHttpApiError.Unauthorized({ message: "Malformed OIDC state cookie" }),
      );
    }
    const { codeVerifier, state: expectedState } = payload;

    const url = buildCallbackUrl(env.ZITADEL_REDIRECT_URI, httpReq.url);
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
      HttpServerResponse.setCookiesUnsafe([
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
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("AuthLive.callback"));
