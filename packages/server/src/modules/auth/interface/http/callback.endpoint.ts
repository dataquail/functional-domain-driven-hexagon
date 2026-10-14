import { CommandBus } from "@effect-server-utils/cqrs";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as cookie from "cookie";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Option from "effect/Option";

import { CookieCodec } from "@/globals/infrastructure/auth/cookie-codec.ts";
import { EnvVars } from "@/globals/infrastructure/config/env-vars.ts";
import { recoverPersistenceUnavailable } from "@/globals/infrastructure/framework/http/http-endpoint.ts";
import { SignInCommand } from "@/modules/auth/commands/sign-in.command.ts";
import { OidcClient } from "@/modules/auth/infrastructure/clients/oidc.client.ts";

import { buildCallbackUrl } from "./callback-url.util.ts";
import { ID_TOKEN_HINT_COOKIE_NAME, readCookie } from "./id-token-hint-cookie.util.ts";
import { decodePkcePayload, PKCE_COOKIE_NAME } from "./oidc-pkce-cookie.util.ts";

export const callbackEndpoint = Effect.fn("AuthLive.callback")(
  function* () {
    const oidc = yield* OidcClient;
    const codec = yield* CookieCodec;
    const env = yield* EnvVars;
    const httpReq = yield* HttpServerRequest.HttpServerRequest;

    const cookies = cookie.parse(httpReq.headers.cookie ?? "");
    const signedPkce = readCookie(cookies, PKCE_COOKIE_NAME);

    if (Option.isNone(signedPkce)) {
      return yield* new CustomHttpApiError.Unauthorized({ message: "Missing OIDC state cookie" });
    }

    const verified = codec.verify(signedPkce.value);

    if (Option.isNone(verified)) {
      return yield* new CustomHttpApiError.Unauthorized({ message: "Invalid OIDC state cookie" });
    }

    const payload = decodePkcePayload(verified.value);

    if (Option.isNone(payload)) {
      return yield* new CustomHttpApiError.Unauthorized({ message: "Malformed OIDC state cookie" });
    }

    const { codeVerifier, state: expectedState } = payload.value;

    const url = buildCallbackUrl(env.IDENTITY_REDIRECT_URI, httpReq.url);
    const exchange = yield* oidc.exchangeCode(url, expectedState, codeVerifier);

    const bus = yield* CommandBus;

    const { sessionId } = yield* bus.execute(SignInCommand, {
      subject: exchange.subject,
      email: exchange.email,
      emailVerified: exchange.emailVerified,
      ttlSeconds: env.SESSION_TTL_SECONDS,
      absoluteTtlSeconds: env.SESSION_ABSOLUTE_TTL_SECONDS,
    });

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
          ID_TOKEN_HINT_COOKIE_NAME,
          Option.getOrElse(exchange.idToken, () => ""),
          {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: env.SESSION_ABSOLUTE_TTL_SECONDS * 1000,
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
  },
  // Both provisioning failures are a 401, and both get the same opaque message:
  // distinguishing them would tell whoever controls the IdP account whether an email
  // is already registered here.
  Effect.catchTags({
    IdentityMissingEmail: () =>
      new CustomHttpApiError.Unauthorized({
        message: "Cannot provision a user for this identity.",
      }),
    IdentityEmailAlreadyRegistered: () =>
      new CustomHttpApiError.Unauthorized({
        message: "Cannot provision a user for this identity.",
      }),
  }),
  recoverPersistenceUnavailable,
);
