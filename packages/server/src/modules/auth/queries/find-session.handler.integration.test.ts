import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/TestClock";
import { beforeEach } from "vitest";

import { SessionRepository } from "@/modules/auth/domain/ports/repositories/session.repository.js";
import {
  SessionExpired,
  SessionNotFound,
  SessionRevoked,
} from "@/modules/auth/domain/session.errors.js";
import { SessionId } from "@/modules/auth/domain/session.id.js";
import { SessionRoot } from "@/modules/auth/domain/session.root.js";
import { SessionRepositoryLive } from "@/modules/auth/infrastructure/repositories/session.repository-live.js";
import { findSession } from "@/modules/auth/queries/find-session.handler.js";
import { FindSessionQuery } from "@/modules/auth/queries/find-session.query.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const sessionId = SessionId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("11111111-1111-1111-1111-111111111111");

// The handler reads `DateTime.now`; pin the TestClock so the lifecycle checks
// against `expiresAt` / `absoluteExpiresAt` are deterministic.
const clockNow = DateTime.unsafeMake(new Date("2026-06-01T00:00:00Z"));
const farPast = DateTime.unsafeMake(new Date("2000-01-01T00:00:00Z"));
const farFuture = DateTime.unsafeMake(new Date("2099-01-01T00:00:00Z"));
const farFutureLater = DateTime.unsafeMake(new Date("2099-12-31T00:00:00Z"));

const TestLayer = SessionRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seedUser = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'owner@example.com', 'USA', '123 Main St', '12345', now(), now())
      `),
    )
    .pipe(Effect.orDie);
});

const baseFields = {
  id: sessionId,
  userId,
  subject: "zitadel-sub",
  revokedAt: null,
  createdAt: farPast,
  lastUsedAt: farPast,
} as const;

const insertSession = (session: SessionRoot) =>
  Effect.gen(function* () {
    const repo = yield* SessionRepository;
    yield* repo.insertOne(session);
  });

const errorOf = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit) && exit.cause._tag === "Fail" ? exit.cause.error : null;

const suite = describe.sequential;

suite("findSession (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("auth.sessions", "user.users").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("returns the session when valid", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
      yield* seedUser;
      yield* insertSession(
        SessionRoot.make({
          ...baseFields,
          expiresAt: farFuture,
          absoluteExpiresAt: farFutureLater,
        }),
      );
      const result = yield* findSession(FindSessionQuery.make({ sessionId }));
      deepStrictEqual(result.id, sessionId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails SessionNotFound for an unknown id", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
      const exit = yield* Effect.exit(findSession(FindSessionQuery.make({ sessionId })));
      deepStrictEqual(errorOf(exit) instanceof SessionNotFound, true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails SessionRevoked when revokedAt is set", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
      yield* seedUser;
      yield* insertSession(
        SessionRoot.make({
          ...baseFields,
          revokedAt: farPast,
          expiresAt: farFuture,
          absoluteExpiresAt: farFutureLater,
        }),
      );
      const exit = yield* Effect.exit(findSession(FindSessionQuery.make({ sessionId })));
      deepStrictEqual(errorOf(exit) instanceof SessionRevoked, true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails SessionExpired when expiresAt is in the past", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
      yield* seedUser;
      yield* insertSession(
        SessionRoot.make({
          ...baseFields,
          expiresAt: farPast,
          absoluteExpiresAt: farFutureLater,
        }),
      );
      const exit = yield* Effect.exit(findSession(FindSessionQuery.make({ sessionId })));
      deepStrictEqual(errorOf(exit) instanceof SessionExpired, true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails SessionExpired when absoluteExpiresAt is in the past", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
      yield* seedUser;
      yield* insertSession(
        SessionRoot.make({
          ...baseFields,
          expiresAt: farFuture,
          absoluteExpiresAt: farPast,
        }),
      );
      const exit = yield* Effect.exit(findSession(FindSessionQuery.make({ sessionId })));
      deepStrictEqual(errorOf(exit) instanceof SessionExpired, true);
    }).pipe(Effect.provide(TestLayer)),
  );
});
