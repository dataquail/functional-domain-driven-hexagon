import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { UserAuthMiddleware } from "@org/contracts/Policy";
import * as cookie from "cookie";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/common/env-vars.js";
import {
  FindSessionQuery,
  SessionId,
  SessionRepository,
  TouchSessionCommand,
} from "@/modules/auth/index.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { PermissionsResolver } from "@/platform/auth/permissions-resolver.js";
import { CommandBus } from "@/platform/ddd/command-bus.js";
import { QueryBus } from "@/platform/ddd/query-bus.js";

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
    const perms = yield* PermissionsResolver;
    // Resolved in outer scope so we can provide it inline below — the
    // per-request Effect must be `Provided` (HTTP request context only),
    // and `bus.execute(FindSessionQuery)` carries the handler's
    // SessionRepository requirement.
    const sessions = yield* SessionRepository;

    return Effect.gen(function* () {
      const httpReq = yield* HttpServerRequest.HttpServerRequest;
      const cookies = cookie.parse(httpReq.headers.cookie ?? "");
      const raw = cookies[env.SESSION_COOKIE_NAME];
      if (raw === undefined || raw === "")
        return yield* Effect.fail(new CustomHttpApiError.Unauthorized());
      const verified = codec.verify(raw);
      if (verified === null) return yield* Effect.fail(new CustomHttpApiError.Unauthorized());
      const sessionId = SessionId.make(verified);
      const session = yield* queryBus
        .execute(FindSessionQuery.make({ sessionId }))
        .pipe(Effect.provideService(SessionRepository, sessions), Effect.mapError(toAuthError));
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
        .pipe(Effect.provideService(SessionRepository, sessions));
      const permissions = yield* perms.get(session.userId).pipe(Effect.mapError(toAuthError));
      return {
        sessionId: session.id,
        userId: session.userId,
        permissions: new Set(permissions),
      };
    }).pipe(Effect.withSpan("auth.middleware"));
  }),
);
