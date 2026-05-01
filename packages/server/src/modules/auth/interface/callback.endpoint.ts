import { EnvVars } from "@/common/env-vars.js";
import { SignInCommand } from "@/modules/auth/commands/sign-in-command.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { CommandBus } from "@/platform/command-bus.js";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as cookie from "cookie";
import * as Effect from "effect/Effect";
import { OidcClient } from "../infrastructure/oidc-client.js";

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

    // openid-client wants the full callback URL it received
    const url = new URL(httpReq.url, env.ZITADEL_REDIRECT_URI);
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
            path: "/auth",
          },
        ],
      ]),
    );
  }).pipe(Effect.withSpan("AuthHttpLive.callback"));
