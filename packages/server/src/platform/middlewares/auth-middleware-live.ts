import { EnvVars } from "@/common/env-vars.js";
import { FindSessionQuery, SessionId, SessionRepository } from "@/modules/auth/index.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { PermissionsResolver } from "@/platform/auth/permissions-resolver.js";
import { QueryBus } from "@/platform/query-bus.js";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { UserAuthMiddleware } from "@org/contracts/Policy";
import * as cookie from "cookie";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export const UserAuthMiddlewareLive = Layer.effect(
  UserAuthMiddleware,
  Effect.gen(function* () {
    const env = yield* EnvVars;
    const codec = yield* CookieCodec;
    const queryBus = yield* QueryBus;
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
      const session = yield* queryBus.execute(FindSessionQuery.make({ sessionId })).pipe(
        Effect.provideService(SessionRepository, sessions),
        Effect.mapError(() => new CustomHttpApiError.Unauthorized()),
      );
      const permissions = yield* perms.get(session.userId);
      return {
        sessionId: session.id,
        userId: session.userId,
        permissions: new Set(permissions),
      };
    }).pipe(Effect.withSpan("auth.middleware"));
  }),
);
