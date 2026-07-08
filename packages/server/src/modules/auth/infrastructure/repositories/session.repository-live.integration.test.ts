import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { SessionRepository } from "@/modules/auth/domain/ports/repositories/session.repository.js";
import { SessionNotFound } from "@/modules/auth/domain/session.errors.js";
import { SessionId } from "@/modules/auth/domain/session.id.js";
import { SessionRootOps } from "@/modules/auth/domain/session.root.js";
import { SessionRepositoryLive } from "@/modules/auth/infrastructure/repositories/session.repository-live.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const sessionId = SessionId.make("22222222-2222-2222-2222-222222222222");
const subject = "zitadel-sub-integration";

const TestLayer = SessionRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const insertUserRow = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db.execute((client) =>
    client.query(sql.unsafe`
      INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'admin@example.com', 'N/A', 'N/A', 'N/A', now(), now())
    `),
  );
}).pipe(Effect.orDie);

const makeSession = (now: DateTime.Utc) =>
  SessionRootOps.create({
    id: sessionId,
    userId,
    subject,
    now,
    ttlSeconds: 3600,
    absoluteTtlSeconds: 43200,
  });

const suite = describe.sequential;

suite("SessionRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("user.users").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("insert + findOneById round-trips a Session through the DB", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* SessionRepository;
      const now = yield* DateTime.now;
      const session = makeSession(now);
      yield* repo.insertOne(session);
      const found = yield* repo.findOneById(sessionId);
      deepStrictEqual(found.id, sessionId);
      deepStrictEqual(found.userId, userId);
      deepStrictEqual(found.subject, subject);
      deepStrictEqual(found.revokedAt, null);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("findOneById fails SessionNotFound for an unknown id", () =>
    Effect.gen(function* () {
      const repo = yield* SessionRepository;
      const exit = yield* Effect.exit(repo.findOneById(sessionId));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof SessionNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("revoke marks revoked_at and a second revoke is reported as NotFound", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* SessionRepository;
      const now = yield* DateTime.now;
      yield* repo.insertOne(makeSession(now));
      yield* repo.deleteOne(sessionId);
      const found = yield* repo.findOneById(sessionId);
      deepStrictEqual(found.revokedAt !== null, true);

      const second = yield* Effect.exit(repo.deleteOne(sessionId));
      deepStrictEqual(Exit.isFailure(second), true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("update persists expiresAt and lastUsedAt for an unrevoked session", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* SessionRepository;
      const now = yield* DateTime.now;
      const seed = makeSession(now);
      yield* repo.insertOne(seed);
      const later = DateTime.add(now, { seconds: 1800 });
      const touched = SessionRootOps.touch({ session: seed, now: later, ttlSeconds: 3600 });
      yield* repo.updateOne(touched);
      const found = yield* repo.findOneById(sessionId);
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
      yield* repo.insertOne(seed);
      yield* repo.deleteOne(sessionId);
      const later = DateTime.add(now, { seconds: 1800 });
      const touched = SessionRootOps.touch({ session: seed, now: later, ttlSeconds: 3600 });
      const exit = yield* Effect.exit(repo.updateOne(touched));
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(Effect.provide(TestLayer)),
  );
});
