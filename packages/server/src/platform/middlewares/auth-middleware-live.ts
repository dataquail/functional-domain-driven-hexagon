import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser, UserAuthMiddleware } from "@org/contracts/Policy";
import { CommandBus, QueryBus } from "@org/cqrs";
import * as cookie from "cookie";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";

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
// (401, log back in). Collapsing the former into the latter would confuse
// clients into a re-auth loop instead of a backoff-and-retry.
//
// Spelled out per tag rather than defaulted, so a new failure member on
// either lookup query is a type error here (the middleware may only fail
// with Unauthorized | ServiceUnavailable) instead of silently becoming a 401.
// `catchTags` is applied inline at each lookup rather than hoisted: it infers
// its error union from the effect it is piped into, so a hoisted combinator
// would widen the channel to `unknown` and defeat the exhaustiveness this is
// here for.
const storeUnavailable = () =>
  new CustomHttpApiError.ServiceUnavailable({ message: "Auth store is unavailable" });
const rejectCredential = () => new CustomHttpApiError.Unauthorized();

export const UserAuthMiddlewareLive = Layer.effect(
  UserAuthMiddleware,
  Effect.gen(function* () {
    const env = yield* EnvVars;
    const codec = yield* CookieCodec;
    const queryBus = yield* QueryBus;
    const commandBus = yield* CommandBus;

    // v4 HttpApiMiddleware is a wrapper: authenticate the request, then
    // `provide` the resolved `CurrentUser` into the downstream endpoint
    // effect. The auth failures (401/503) join the endpoint's error channel.
    const authenticate = Effect.gen(function* () {
      const httpReq = yield* HttpServerRequest.HttpServerRequest;

      // Bearer path (CLI / MCP / CI — ADR-0005): an `Authorization: Bearer`
      // token takes precedence over the cookie. We hash the presented token
      // here so the raw secret never travels through the bus or a span,
      // then resolve it to the same `CurrentUser` the cookie path produces.
      const bearer = readBearer(httpReq.headers.authorization);
      if (bearer !== null) {
        const apiToken = yield* queryBus
          .execute(FindApiTokenByHashQuery, { tokenHash: CredentialHash.of(bearer) })
          .pipe(
            Effect.catchTags({
              PersistenceUnavailable: storeUnavailable,
              ApiTokenNotFound: rejectCredential,
              ApiTokenExpired: rejectCredential,
              ApiTokenRevoked: rejectCredential,
            }),
          );
        // Last-used stamp, forked off the request fiber (`forkDetach`) so its
        // lookup + throttle never sit on the auth critical path. Detached from
        // the request scope so it outlives the response; throttled +
        // error-swallowing in the handler. Same rationale as the session touch.
        yield* commandBus
          .execute(TouchApiTokenCommand, {
            apiTokenId: apiToken.id,
            thresholdSeconds: env.API_TOKEN_TOUCH_THRESHOLD_SECONDS,
          })
          .pipe(Effect.forkDetach);
        // No browser session for a bearer caller; the token id stands in as
        // the opaque principal id on `CurrentUser` (Policy.ts unchanged).
        return { sessionId: apiToken.id, userId: apiToken.userId };
      }

      const cookies = cookie.parse(httpReq.headers.cookie ?? "");
      const raw = cookies[env.SESSION_COOKIE_NAME];
      if (raw === undefined || raw === "") return yield* new CustomHttpApiError.Unauthorized();
      const verified = codec.verify(raw);
      if (verified === null) return yield* new CustomHttpApiError.Unauthorized();
      const sessionId = SessionId.make(verified);
      const session = yield* queryBus.execute(FindSessionQuery, { sessionId }).pipe(
        Effect.catchTags({
          PersistenceUnavailable: storeUnavailable,
          SessionNotFound: rejectCredential,
          SessionExpired: rejectCredential,
          SessionRevoked: rejectCredential,
        }),
      );
      // Sliding-TTL refresh, forked off the request fiber (`forkDetach`) so it
      // stays off the auth critical path and outlives the response. The
      // command's own throttle decides whether to write; failures are
      // benign races (revoked / removed mid-flight) and are swallowed by
      // the handler so they never bubble up as a 401.
      yield* commandBus
        .execute(TouchSessionCommand, {
          sessionId,
          ttlSeconds: env.SESSION_TTL_SECONDS,
          thresholdSeconds: env.SESSION_TOUCH_THRESHOLD_SECONDS,
        })
        .pipe(Effect.forkDetach);
      return {
        sessionId: session.id,
        userId: session.userId,
      };
    }).pipe(Effect.withSpan("auth.middleware"));

    return (httpEffect) =>
      authenticate.pipe(
        Effect.flatMap((currentUser) =>
          Effect.provideService(httpEffect, CurrentUser, currentUser),
        ),
      );
  }),
);
