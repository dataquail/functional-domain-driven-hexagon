import {
  SessionExpired,
  SessionNotFound,
  SessionRevoked,
} from "@/modules/auth/domain/session-errors.js";
import { SessionId } from "@/modules/auth/domain/session-id.js";
import { SessionRepository } from "@/modules/auth/domain/session-repository.js";
import { Session } from "@/modules/auth/domain/session.aggregate.js";
import { SessionRepositoryFake } from "@/modules/auth/infrastructure/session-repository-fake.js";
import { FindSessionQuery } from "@/modules/auth/queries/find-session-query.js";
import { findSession } from "@/modules/auth/queries/find-session.js";
import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

const sessionId = SessionId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("11111111-1111-1111-1111-111111111111");

// Cases that touch lifecycle (`expiresAt` / `absoluteExpiresAt` / revocation)
// run with `it.live` so `DateTime.now` reads the real wall clock — `it.effect`
// uses TestClock which starts at the Unix epoch and would defeat
// "future"/"past" assertions.
const farPast = DateTime.unsafeMake(new Date("2000-01-01T00:00:00Z"));
const farFuture = DateTime.unsafeMake(new Date("2099-01-01T00:00:00Z"));
const farFutureLater = DateTime.unsafeMake(new Date("2099-12-31T00:00:00Z"));

const insertSession = (session: Session) =>
  Effect.flatMap(SessionRepository, (repo) => repo.insert(session));

const baseFields = {
  id: sessionId,
  userId,
  subject: "zitadel-sub",
  revokedAt: null,
  createdAt: farPast,
  lastUsedAt: farPast,
} as const;

describe("findSession", () => {
  it.live("returns the session when valid", () =>
    Effect.gen(function* () {
      yield* insertSession(
        Session.make({
          ...baseFields,
          expiresAt: farFuture,
          absoluteExpiresAt: farFutureLater,
        }),
      );
      const result = yield* findSession(FindSessionQuery.make({ sessionId }));
      deepStrictEqual(result.id, sessionId);
    }).pipe(Effect.provide(SessionRepositoryFake)),
  );

  it.effect("fails SessionNotFound for an unknown id", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(findSession(FindSessionQuery.make({ sessionId })));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof SessionNotFound, true);
      }
    }).pipe(Effect.provide(SessionRepositoryFake)),
  );

  it.live("fails SessionRevoked when revokedAt is set", () =>
    Effect.gen(function* () {
      yield* insertSession(
        Session.make({
          ...baseFields,
          revokedAt: farPast,
          expiresAt: farFuture,
          absoluteExpiresAt: farFutureLater,
        }),
      );
      const exit = yield* Effect.exit(findSession(FindSessionQuery.make({ sessionId })));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof SessionRevoked, true);
      }
    }).pipe(Effect.provide(SessionRepositoryFake)),
  );

  it.live("fails SessionExpired when expiresAt is in the past", () =>
    Effect.gen(function* () {
      yield* insertSession(
        Session.make({
          ...baseFields,
          expiresAt: farPast,
          absoluteExpiresAt: farFutureLater,
        }),
      );
      const exit = yield* Effect.exit(findSession(FindSessionQuery.make({ sessionId })));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof SessionExpired, true);
      }
    }).pipe(Effect.provide(SessionRepositoryFake)),
  );

  it.live("fails SessionExpired when absoluteExpiresAt is in the past", () =>
    Effect.gen(function* () {
      yield* insertSession(
        Session.make({
          ...baseFields,
          expiresAt: farFuture,
          absoluteExpiresAt: farPast,
        }),
      );
      const exit = yield* Effect.exit(findSession(FindSessionQuery.make({ sessionId })));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof SessionExpired, true);
      }
    }).pipe(Effect.provide(SessionRepositoryFake)),
  );
});
