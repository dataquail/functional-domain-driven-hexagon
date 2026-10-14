import { CommandBus, QueryBus } from "@effect-server-utils/cqrs";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser, UserAuthMiddleware } from "@org/contracts/Policy";
import * as cookie from "cookie";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { CookieCodec } from "@/globals/infrastructure/auth/cookie-codec.js";
import { EnvVars } from "@/globals/infrastructure/config/env-vars.js";
import { waitUntil } from "@/globals/infrastructure/runtime/execution-context.js";
import {
  CredentialHash,
  FindApiTokenByHashQuery,
  FindSessionQuery,
  SessionId,
  TouchApiTokenCommand,
  TouchSessionCommand,
} from "@/modules/auth/auth.platform.js";

// `Authorization: Bearer <token>` — case-insensitive scheme. The raw token,
// or none when the header is absent or not a bearer credential.
const BEARER_PREFIX = /^Bearer\s+/i;

const readBearer = (authorization: Option.Option<string>): Option.Option<string> =>
  authorization.pipe(
    Option.map((header) => header.trim()),
    Option.filter((header) => BEARER_PREFIX.test(header)),
    Option.map((header) => header.replace(BEARER_PREFIX, "").trim()),
    Option.filter((token) => token !== ""),
  );

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
      const bearer = readBearer(Option.fromUndefinedOr(httpReq.headers.authorization));

      if (Option.isSome(bearer)) {
        const apiToken = yield* queryBus
          .execute(FindApiTokenByHashQuery, { tokenHash: CredentialHash.of(bearer.value) })
          .pipe(
            Effect.catchTags({
              PersistenceUnavailable: storeUnavailable,
              ApiTokenNotFound: rejectCredential,
              ApiTokenExpired: rejectCredential,
              ApiTokenRevoked: rejectCredential,
            }),
          );

        // Off the auth critical path and outliving the response; the handler
        // throttles and swallows its own failures.
        yield* waitUntil(
          commandBus.execute(TouchApiTokenCommand, {
            apiTokenId: apiToken.id,
            thresholdSeconds: env.API_TOKEN_TOUCH_THRESHOLD_SECONDS,
          }),
        );

        // No browser session for a bearer caller; the token id stands in as
        // the opaque principal id on `CurrentUser` (Policy.ts unchanged).
        return { sessionId: apiToken.id, userId: apiToken.userId };
      }

      const cookieHeader = Option.fromUndefinedOr(httpReq.headers.cookie);

      const verified = cookieHeader.pipe(
        Option.flatMap((header) =>
          Option.fromUndefinedOr(cookie.parse(header)[env.SESSION_COOKIE_NAME]),
        ),
        Option.filter((raw) => raw !== ""),
        Option.flatMap(codec.verify),
      );

      if (Option.isNone(verified)) return yield* new CustomHttpApiError.Unauthorized();

      const sessionId = SessionId.make(verified.value);

      const session = yield* queryBus.execute(FindSessionQuery, { sessionId }).pipe(
        Effect.catchTags({
          PersistenceUnavailable: storeUnavailable,
          SessionNotFound: rejectCredential,
          SessionExpired: rejectCredential,
          SessionRevoked: rejectCredential,
        }),
      );

      // Sliding-TTL refresh, off the auth critical path; the command's own
      // throttle decides whether to write and swallows benign races.
      yield* waitUntil(
        commandBus.execute(TouchSessionCommand, {
          sessionId,
          ttlSeconds: env.SESSION_TTL_SECONDS,
          thresholdSeconds: env.SESSION_TOUCH_THRESHOLD_SECONDS,
        }),
      );

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
