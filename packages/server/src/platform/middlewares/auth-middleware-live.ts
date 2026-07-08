import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { UserAuthMiddleware } from "@org/contracts/Policy";
import { Database } from "@org/database/index";
import * as cookie from "cookie";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/common/env-vars.js";
import {
  CredentialHash,
  FindApiTokenByHashQuery,
  FindSessionQuery,
  SessionId,
  TouchApiTokenCommand,
  TouchSessionCommand,
} from "@/modules/auth/index.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";

// `Authorization: Bearer <token>` — case-insensitive scheme. Returns the
// raw token, or null when the header is absent or not a bearer credential.
const BEARER_PREFIX = /^Bearer\s+/i;
const readBearer = (authorization: string | undefined): string | null => {
  if (authorization === undefined) return null;
  const trimmed = authorization.trim();
  if (!BEARER_PREFIX.test(trimmed)) return null;
  const token = trimmed.replace(BEARER_PREFIX, "").trim();
  return token === "" ? null : token;
};

// Distinguish "the DB is down" (503, retry) from "your session is bad"
// (401, log back in). `Effect.mapError(() => Unauthorized)` would collapse
// the former into the latter and confuse clients into a re-auth loop.
const toAuthError = (e: {
  readonly _tag: string;
}): CustomHttpApiError.Unauthorized | CustomHttpApiError.ServiceUnavailable =>
  e._tag === "PersistenceUnavailable"
    ? new CustomHttpApiError.ServiceUnavailable({ message: "Auth store is unavailable" })
    : new CustomHttpApiError.Unauthorized();

export const UserAuthMiddlewareLive = Layer.effect(
  UserAuthMiddleware,
  Effect.gen(function* () {
    const env = yield* EnvVars;
    const codec = yield* CookieCodec;
    const queryBus = yield* QueryBus;
    const commandBus = yield* CommandBus;
    // Captured here so the per-request Effect can satisfy the bus
    // dispatch's Database requirement inline — auth-module handlers
    // wrap their own SessionRepository (Stage B), leaving Database in R.
    const db = yield* Database.Database;

    return Effect.gen(function* () {
      const httpReq = yield* HttpServerRequest.HttpServerRequest;

      // Bearer path (CLI / MCP / CI — ADR-0024): an `Authorization: Bearer`
      // token takes precedence over the cookie. We hash the presented token
      // here so the raw secret never travels through the bus or a span,
      // then resolve it to the same `CurrentUser` the cookie path produces.
      const bearer = readBearer(httpReq.headers.authorization);
      if (bearer !== null) {
        const apiToken = yield* queryBus
          .execute(FindApiTokenByHashQuery.make({ tokenHash: CredentialHash.of(bearer) }))
          .pipe(Effect.provideService(Database.Database, db), Effect.mapError(toAuthError));
        // Fire-and-forget last-used stamp; throttled + error-swallowing in the
        // handler, same rationale as the session touch below.
        yield* commandBus
          .execute(
            TouchApiTokenCommand.make({
              apiTokenId: apiToken.id,
              thresholdSeconds: env.API_TOKEN_TOUCH_THRESHOLD_SECONDS,
            }),
          )
          .pipe(Effect.provideService(Database.Database, db));
        // No browser session for a bearer caller; the token id stands in as
        // the opaque principal id on `CurrentUser` (Policy.ts unchanged).
        return { sessionId: apiToken.id, userId: apiToken.userId };
      }

      const cookies = cookie.parse(httpReq.headers.cookie ?? "");
      const raw = cookies[env.SESSION_COOKIE_NAME];
      if (raw === undefined || raw === "")
        return yield* Effect.fail(new CustomHttpApiError.Unauthorized());
      const verified = codec.verify(raw);
      if (verified === null) return yield* Effect.fail(new CustomHttpApiError.Unauthorized());
      const sessionId = SessionId.make(verified);
      const session = yield* queryBus
        .execute(FindSessionQuery.make({ sessionId }))
        .pipe(Effect.provideService(Database.Database, db), Effect.mapError(toAuthError));
      // Sliding-TTL refresh, fire-and-forget on the request fiber. The
      // command's own throttle decides whether to write; failures are
      // benign races (revoked / removed mid-flight) and are swallowed by
      // the handler so they never bubble up as a 401.
      yield* commandBus
        .execute(
          TouchSessionCommand.make({
            sessionId,
            ttlSeconds: env.SESSION_TTL_SECONDS,
            thresholdSeconds: env.SESSION_TOUCH_THRESHOLD_SECONDS,
          }),
        )
        .pipe(Effect.provideService(Database.Database, db));
      return {
        sessionId: session.id,
        userId: session.userId,
      };
    }).pipe(Effect.withSpan("auth.middleware"));
  }),
);
