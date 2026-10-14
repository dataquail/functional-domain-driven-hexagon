import { CommandBus } from "@effect-server-utils/cqrs";
import * as cookie from "cookie";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Option from "effect/Option";

import { CookieCodec } from "@/globals/infrastructure/auth/cookie-codec.ts";
import { EnvVars } from "@/globals/infrastructure/config/env-vars.ts";
import { RevokeSessionCommand } from "@/modules/auth/commands/revoke-session.command.ts";
import { SessionId } from "@/modules/auth/domain/session/session.id.ts";
import { OidcClient } from "@/modules/auth/infrastructure/clients/oidc.client.ts";

import {
  ID_TOKEN_HINT_COOKIE_NAME,
  readCookie,
  readIdTokenHint,
} from "./id-token-hint-cookie.util.ts";

// Reads the session cookie inline rather than through middleware: logout must work
// even when the session is already gone.
export const logoutEndpoint = Effect.fn("AuthLive.logout")(function* () {
  const env = yield* EnvVars;
  const codec = yield* CookieCodec;
  const oidc = yield* OidcClient;
  const httpReq = yield* HttpServerRequest.HttpServerRequest;
  const commandBus = yield* CommandBus;

  const cookies = cookie.parse(httpReq.headers.cookie ?? "");

  const sessionId = Option.flatMap(readCookie(cookies, env.SESSION_COOKIE_NAME), (raw) =>
    codec.verify(raw),
  );

  if (Option.isSome(sessionId)) {
    yield* commandBus.execute(RevokeSessionCommand, { sessionId: SessionId.make(sessionId.value) });
  }

  const endSessionUrl = yield* oidc.buildEndSessionUrl(readIdTokenHint(cookies)).pipe(
    Effect.map((u) => u.toString()),
    // An unreachable issuer still gets a local logout; its own session outlives it.
    Effect.orElseSucceed(() => env.APP_URL),
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
      [ID_TOKEN_HINT_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" }],
    ]),
  );
});
