import { CommandBus } from "@effect-server-utils/cqrs";
import * as cookie from "cookie";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import { CookieCodec } from "@/globals/infrastructure/auth/cookie-codec.js";
import { EnvVars } from "@/globals/infrastructure/config/env-vars.js";
import { RevokeSessionCommand } from "@/modules/auth/commands/revoke-session.command.js";
import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { OidcClient } from "@/modules/auth/infrastructure/clients/oidc.client.js";

import { ID_TOKEN_HINT_COOKIE_NAME, readIdTokenHint } from "./id-token-hint-cookie.util.js";

// Reads the session cookie inline rather than through middleware: logout must work
// even when the session is already gone.
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
      yield* commandBus.execute(RevokeSessionCommand, { sessionId: SessionId.make(verified) });
    }
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
