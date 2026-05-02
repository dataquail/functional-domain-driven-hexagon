import { SessionNotFound } from "@/modules/auth/domain/session-errors.js";
import { SessionId } from "@/modules/auth/domain/session-id.js";
import { SessionRepository } from "@/modules/auth/domain/session-repository.js";
import * as Session from "@/modules/auth/domain/session.aggregate.js";
import { SessionRepositoryLive } from "@/modules/auth/infrastructure/session-repository-live.js";
import { UserId } from "@/platform/ids/user-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";
import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const sessionId = SessionId.make("22222222-2222-2222-2222-222222222222");
const subject = "zitadel-sub-integration";

const TestLayer = SessionRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const insertUserRow = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db.execute((client) =>
    client.query(sql.unsafe`
      INSERT INTO users (id, email, role, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'admin@example.com', 'admin', 'N/A', 'N/A', 'N/A', now(), now())
    `),
  );
}).pipe(Effect.orDie);

const makeSession = (now: DateTime.Utc) =>
  Session.create({
    id: sessionId,
    userId,
    subject,
    now,
    ttlSeconds: 3600,
    absoluteTtlSeconds: 43200,
  });

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("SessionRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("users").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("insert + findById round-trips a Session through the DB", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* SessionRepository;
      const now = yield* DateTime.now;
      const session = makeSession(now);
      yield* repo.insert(session);
      const found = yield* repo.findById(sessionId);
      deepStrictEqual(found.id, sessionId);
      deepStrictEqual(found.userId, userId);
      deepStrictEqual(found.subject, subject);
      deepStrictEqual(found.revokedAt, null);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("findById fails SessionNotFound for an unknown id", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const exit = yield* Effect.exit(repo.findById(sessionId));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof SessionNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("revoke marks revoked_at and a second revoke is reported as NotFound", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* SessionRepository;
      const now = yield* DateTime.now;
      yield* repo.insert(makeSession(now));
      yield* repo.revoke(sessionId);
      const found = yield* repo.findById(sessionId);
      deepStrictEqual(found.revokedAt !== null, true);

      const second = yield* Effect.exit(repo.revoke(sessionId));
      deepStrictEqual(Exit.isFailure(second), true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("update persists expiresAt and lastUsedAt for an unrevoked session", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* SessionRepository;
      const now = yield* DateTime.now;
      const seed = makeSession(now);
      yield* repo.insert(seed);
      const later = DateTime.add(now, { seconds: 1800 });
      const touched = Session.touch({ session: seed, now: later, ttlSeconds: 3600 });
      yield* repo.update(touched);
      const found = yield* repo.findById(sessionId);
      deepStrictEqual(found.expiresAt, touched.expiresAt);
      deepStrictEqual(found.lastUsedAt, touched.lastUsedAt);
      deepStrictEqual(found.absoluteExpiresAt, seed.absoluteExpiresAt);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("update fails SessionNotFound when the row is revoked", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* SessionRepository;
      const now = yield* DateTime.now;
      const seed = makeSession(now);
      yield* repo.insert(seed);
      yield* repo.revoke(sessionId);
      const later = DateTime.add(now, { seconds: 1800 });
      const touched = Session.touch({ session: seed, now: later, ttlSeconds: 3600 });
      const exit = yield* Effect.exit(repo.update(touched));
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(Effect.provide(TestLayer)),
  );
});
