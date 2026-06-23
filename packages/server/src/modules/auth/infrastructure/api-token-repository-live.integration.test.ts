import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import * as ApiToken from "@/modules/auth/domain/api-token.aggregate.js";
import { ApiTokenNotFound } from "@/modules/auth/domain/api-token-errors.js";
import { ApiTokenId } from "@/modules/auth/domain/api-token-id.js";
import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token-repository.js";
import { ApiTokenRepositoryLive } from "@/modules/auth/infrastructure/api-token-repository-live.js";
import { UserId } from "@/platform/ids/user-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const idA = ApiTokenId.make("22222222-2222-2222-2222-222222222222");
const idB = ApiTokenId.make("33333333-3333-3333-3333-333333333333");

const TestLayer = ApiTokenRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const insertUserRow = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db.execute((client) =>
    client.query(sql.unsafe`
      INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'tokens@example.com', 'N/A', 'N/A', 'N/A', now(), now())
    `),
  );
}).pipe(Effect.orDie);

const make = (id: ApiTokenId, hash: string, now: DateTime.Utc, createdAt?: DateTime.Utc) =>
  ApiToken.mint({
    id,
    userId,
    tokenHash: hash,
    prefix: "pat_abcd1234",
    label: "ci",
    now: createdAt ?? now,
    expiresAt: DateTime.add(createdAt ?? now, { days: 90 }),
  });

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("ApiTokenRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("auth.api_tokens", "user.users").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("insert + findById + findByHash round-trip a token through the DB", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* ApiTokenRepository;
      const now = yield* DateTime.now;
      yield* repo.insert(make(idA, "hash-A", now));
      const byId = yield* repo.findById(idA);
      deepStrictEqual(byId.id, idA);
      deepStrictEqual(byId.userId, userId);
      deepStrictEqual(byId.tokenHash, "hash-A");
      deepStrictEqual(byId.revokedAt, null);
      deepStrictEqual((yield* repo.findByHash("hash-A")).id, idA);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("findByHash fails ApiTokenNotFound for an unknown hash", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      const exit = yield* Effect.exit(repo.findByHash("missing"));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof ApiTokenNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("listByUser returns active tokens newest-first and hides revoked", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* ApiTokenRepository;
      const now = yield* DateTime.now;
      yield* repo.insert(make(idA, "a", now, now));
      yield* repo.insert(make(idB, "b", now, DateTime.add(now, { hours: 1 })));
      yield* repo.delete(idA);
      const mine = yield* repo.listByUser(userId);
      deepStrictEqual(
        mine.map((t) => t.id),
        [idB],
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("delete soft-revokes and a second delete is reported as NotFound", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* ApiTokenRepository;
      const now = yield* DateTime.now;
      yield* repo.insert(make(idA, "a", now));
      yield* repo.delete(idA);
      deepStrictEqual((yield* repo.findById(idA)).revokedAt !== null, true);
      const second = yield* Effect.exit(repo.delete(idA));
      deepStrictEqual(Exit.isFailure(second), true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("update persists last_used_at for an active token", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* ApiTokenRepository;
      const now = yield* DateTime.now;
      const seed = make(idA, "a", now);
      yield* repo.insert(seed);
      const later = DateTime.add(now, { hours: 2 });
      yield* repo.update(ApiToken.touch({ token: seed, now: later }));
      const found = yield* repo.findById(idA);
      deepStrictEqual(found.lastUsedAt, later);
      deepStrictEqual(found.expiresAt, seed.expiresAt);
    }).pipe(Effect.provide(TestLayer)),
  );
});
