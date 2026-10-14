import { deepStrictEqual } from "node:assert";

import { assertInstanceOf } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as TestClock from "effect/testing/TestClock";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { SessionId } from "@/modules/auth/domain/session/session.id";
import { SessionRepository } from "@/modules/auth/domain/session/session.repository";
import { SessionRoot } from "@/modules/auth/domain/session/session.root";
import { SessionRepositoryLive } from "@/modules/auth/infrastructure/repositories/session.repository-live";
import { findSessionHandler } from "@/modules/auth/queries/find-session.handler";
import {
  SessionExpired,
  SessionNotFound,
  SessionRevoked,
} from "@/modules/auth/queries/find-session.query";
import { describeIntegration } from "@/test-utils/server-test-runtime";
import { TestDatabaseLive } from "@/test-utils/test-database";

const sessionId = SessionId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("11111111-1111-1111-1111-111111111111");

// The handler reads `DateTime.now`; each test pins a TestClock so the lifecycle checks
// against `expiresAt` / `absoluteExpiresAt` are deterministic.
const clockNow = DateTime.makeUnsafe("2026-06-01T00:00:00Z");
const farPast = DateTime.makeUnsafe("2000-01-01T00:00:00Z");
const farFuture = DateTime.makeUnsafe("2099-01-01T00:00:00Z");
const farFutureLater = DateTime.makeUnsafe("2099-12-31T00:00:00Z");

const TestLayer = SessionRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seedUser = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'owner@example.com', 'USA', '123 Main St', '12345', now(), now())
      `.pipe(Effect.orDie);
});

const baseFields = {
  id: sessionId,
  userId,
  subject: "identity-sub",
  revokedAt: Option.none(),
  createdAt: farPast,
  lastUsedAt: farPast,
} as const;

const insertSession = (session: SessionRoot) =>
  Effect.gen(function* () {
    const repo = yield* SessionRepository;
    yield* repo.insertOne(session);
  });

describeIntegration(
  "findSessionHandler (integration)",
  { layer: TestLayer, tables: ["auth.sessions", "user.users"] },
  (it) => {
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
        const result = yield* findSessionHandler({ sessionId });
        deepStrictEqual(result.id, sessionId);
      }).pipe(Effect.provide(TestClock.layer())),
    );

    it.effect("fails SessionNotFound for an unknown id", () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
        assertInstanceOf(yield* Effect.flip(findSessionHandler({ sessionId })), SessionNotFound);
      }).pipe(Effect.provide(TestClock.layer())),
    );

    it.effect("fails SessionRevoked when revokedAt is set", () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
        yield* seedUser;
        yield* insertSession(
          SessionRoot.make({
            ...baseFields,
            revokedAt: Option.some(farPast),
            expiresAt: farFuture,
            absoluteExpiresAt: farFutureLater,
          }),
        );
        assertInstanceOf(yield* Effect.flip(findSessionHandler({ sessionId })), SessionRevoked);
      }).pipe(Effect.provide(TestClock.layer())),
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
        assertInstanceOf(yield* Effect.flip(findSessionHandler({ sessionId })), SessionExpired);
      }).pipe(Effect.provide(TestClock.layer())),
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
        assertInstanceOf(yield* Effect.flip(findSessionHandler({ sessionId })), SessionExpired);
      }).pipe(Effect.provide(TestClock.layer())),
    );
  },
);
