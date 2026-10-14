import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token/api-token.root-ops";
import { ApiTokenSpecifications } from "@/modules/auth/domain/api-token/api-token.specification";

import { ApiTokenRepositoryFake } from "./api-token.repository-fake";

const idA = ApiTokenId.make("11111111-1111-1111-1111-111111111111");
const idB = ApiTokenId.make("22222222-2222-2222-2222-222222222222");
const idMissing = ApiTokenId.make("99999999-9999-9999-9999-999999999999");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const otherUserId = UserId.make("44444444-4444-4444-4444-444444444444");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const make = (id: ApiTokenId, opts: { userId?: UserId; hash?: string; createdAt?: DateTime.Utc }) =>
  ApiTokenRootOps.mint({
    id,
    userId: opts.userId ?? userId,
    tokenHash: opts.hash ?? `hash-${id}`,
    prefix: "pat_abcd1234",
    label: "ci",
    now: opts.createdAt ?? now,
    expiresAt: Option.some(DateTime.add(opts.createdAt ?? now, { days: 90 })),
  });

const provide = Effect.provide(ApiTokenRepositoryFake);

describe("ApiTokenRepositoryFake", () => {
  it.effect("insert + findOne by id and by hash round-trip", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      yield* repo.insertOne(make(idA, { hash: "hash-A" }));

      const byId = yield* repo
        .findOne(ApiTokenSpecifications.withId(idA))
        .pipe(Effect.flatMap(Effect.fromOption));

      const byHash = yield* repo
        .findOne(ApiTokenSpecifications.withHash("hash-A"))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(byId.id, idA);
      deepStrictEqual(byHash.id, idA);
    }).pipe(provide),
  );

  it.effect("findOne returns null when absent (absence is not an error)", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      const byId = yield* repo.findOne(ApiTokenSpecifications.withId(idMissing));
      const byHash = yield* repo.findOne(ApiTokenSpecifications.withHash("nope"));
      assertNone(byId);
      assertNone(byHash);
    }).pipe(provide),
  );

  it.effect("findMany(forUser) returns only the caller's active tokens, newest first", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      yield* repo.insertOne(make(idA, { hash: "a", createdAt: now }));
      yield* repo.insertOne(make(idB, { hash: "b", createdAt: DateTime.add(now, { hours: 1 }) }));
      yield* repo.insertOne(make(idMissing, { userId: otherUserId, hash: "c" }));
      const mine = yield* repo.findMany(ApiTokenSpecifications.forUser(userId));
      deepStrictEqual(
        mine.map((t) => t.id),
        [idB, idA],
      );
    }).pipe(provide),
  );

  it.effect("delete soft-revokes; a second delete fails NotFound; findMany hides it", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      yield* repo.insertOne(make(idA, { hash: "a" }));
      yield* repo.deleteOne(idA);

      const found = yield* repo
        .findOne(ApiTokenSpecifications.withId(idA))
        .pipe(Effect.flatMap(Effect.fromOption));

      assertTrue(Option.isSome(found.revokedAt));
      deepStrictEqual((yield* repo.findMany(ApiTokenSpecifications.forUser(userId))).length, 0);
      const second = yield* Effect.exit(repo.deleteOne(idA));
      deepStrictEqual(Exit.isFailure(second), true);
    }).pipe(provide),
  );

  it.effect("update advances lastUsedAt for an active token and fails NotFound when revoked", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      const seed = make(idA, { hash: "a" });
      yield* repo.insertOne(seed);
      const later = DateTime.add(now, { hours: 2 });
      yield* repo.updateOne(ApiTokenRootOps.touch({ token: seed, now: later }));

      const found = yield* repo
        .findOne(ApiTokenSpecifications.withId(idA))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(found.lastUsedAt, later);

      yield* repo.deleteOne(idA);

      const exit = yield* Effect.exit(
        repo.updateOne(ApiTokenRootOps.touch({ token: seed, now: later })),
      );

      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(provide),
  );
});
