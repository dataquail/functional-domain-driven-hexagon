import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.js";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token/api-token.root-ops.js";
import { ApiTokenSpecifications } from "@/modules/auth/domain/api-token/api-token.specification.js";
import { ApiTokenRepositoryLive } from "@/modules/auth/infrastructure/repositories/api-token.repository-live.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

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
  ApiTokenRootOps.mint({
    id,
    userId,
    tokenHash: hash,
    prefix: "pat_abcd1234",
    label: "ci",
    now: createdAt ?? now,
    expiresAt: DateTime.add(createdAt ?? now, { days: 90 }),
  });

const suite = describe.sequential;

suite("ApiTokenRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("auth.api_tokens", "user.users").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("insert + findOne by id and by hash round-trip a token through the DB", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* ApiTokenRepository;
      const now = yield* DateTime.now;
      yield* repo.insertOne(make(idA, "hash-A", now));
      const byId = yield* repo.findOne(ApiTokenSpecifications.withId(idA));
      const byHash = yield* repo.findOne(ApiTokenSpecifications.withHash("hash-A"));
      if (byId === null || byHash === null) throw new Error("expected a token");
      deepStrictEqual(byId.id, idA);
      deepStrictEqual(byId.userId, userId);
      deepStrictEqual(byId.tokenHash, "hash-A");
      deepStrictEqual(byId.revokedAt, null);
      deepStrictEqual(byHash.id, idA);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("findOne returns null for an unknown hash (absence is not an error)", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      const found = yield* repo.findOne(ApiTokenSpecifications.withHash("missing"));
      deepStrictEqual(found, null);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("findMany(forUser) returns active tokens newest-first and hides revoked", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* ApiTokenRepository;
      const now = yield* DateTime.now;
      yield* repo.insertOne(make(idA, "a", now, now));
      yield* repo.insertOne(make(idB, "b", now, DateTime.add(now, { hours: 1 })));
      yield* repo.deleteOne(idA);
      const mine = yield* repo.findMany(ApiTokenSpecifications.forUser(userId));
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
      yield* repo.insertOne(make(idA, "a", now));
      yield* repo.deleteOne(idA);
      const found = yield* repo.findOne(ApiTokenSpecifications.withId(idA));
      if (found === null) throw new Error("expected a token");
      deepStrictEqual(found.revokedAt !== null, true);
      const second = yield* Effect.exit(repo.deleteOne(idA));
      deepStrictEqual(Exit.isFailure(second), true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("update persists last_used_at for an active token", () =>
    Effect.gen(function* () {
      yield* insertUserRow;
      const repo = yield* ApiTokenRepository;
      const now = yield* DateTime.now;
      const seed = make(idA, "a", now);
      yield* repo.insertOne(seed);
      const later = DateTime.add(now, { hours: 2 });
      yield* repo.updateOne(ApiTokenRootOps.touch({ token: seed, now: later }));
      const found = yield* repo.findOne(ApiTokenSpecifications.withId(idA));
      if (found === null) throw new Error("expected a token");
      deepStrictEqual(found.lastUsedAt, later);
      deepStrictEqual(found.expiresAt, seed.expiresAt);
    }).pipe(Effect.provide(TestLayer)),
  );
});
