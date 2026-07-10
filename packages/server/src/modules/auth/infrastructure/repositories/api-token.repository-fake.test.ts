import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { ApiTokenNotFound } from "@/modules/auth/domain/api-token.errors.js";
import { ApiTokenId } from "@/modules/auth/domain/api-token.id.js";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token.root-ops.js";
import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token.repository.js";
import { UserId } from "@/platform/ids/user-id.js";

import { ApiTokenRepositoryFake } from "./api-token.repository-fake.js";

const idA = ApiTokenId.make("11111111-1111-1111-1111-111111111111");
const idB = ApiTokenId.make("22222222-2222-2222-2222-222222222222");
const idMissing = ApiTokenId.make("99999999-9999-9999-9999-999999999999");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const otherUserId = UserId.make("44444444-4444-4444-4444-444444444444");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const make = (id: ApiTokenId, opts: { userId?: UserId; hash?: string; createdAt?: DateTime.Utc }) =>
  ApiTokenRootOps.mint({
    id,
    userId: opts.userId ?? userId,
    tokenHash: opts.hash ?? `hash-${id}`,
    prefix: "pat_abcd1234",
    label: "ci",
    now: opts.createdAt ?? now,
    expiresAt: DateTime.add(opts.createdAt ?? now, { days: 90 }),
  });

const provide = Effect.provide(ApiTokenRepositoryFake);

describe("ApiTokenRepositoryFake", () => {
  it.effect("insert + findOneById + findOneByHash round-trip", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      yield* repo.insertOne(make(idA, { hash: "hash-A" }));
      deepStrictEqual((yield* repo.findOneById(idA)).id, idA);
      deepStrictEqual((yield* repo.findOneByHash("hash-A")).id, idA);
    }).pipe(provide),
  );

  it.effect("findOneById / findOneByHash fail ApiTokenNotFound when absent", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      const byId = yield* Effect.exit(repo.findOneById(idMissing));
      const byHash = yield* Effect.exit(repo.findOneByHash("nope"));
      deepStrictEqual(Exit.isFailure(byId), true);
      deepStrictEqual(Exit.isFailure(byHash), true);
      if (Exit.isFailure(byId)) {
        const error = Cause.hasFails(byId.cause)
          ? Cause.findErrorOption(byId.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof ApiTokenNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("findManyByUser returns only the caller's active tokens, newest first", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      yield* repo.insertOne(make(idA, { hash: "a", createdAt: now }));
      yield* repo.insertOne(make(idB, { hash: "b", createdAt: DateTime.add(now, { hours: 1 }) }));
      yield* repo.insertOne(make(idMissing, { userId: otherUserId, hash: "c" }));
      const mine = yield* repo.findManyByUser(userId);
      deepStrictEqual(
        mine.map((t) => t.id),
        [idB, idA],
      );
    }).pipe(provide),
  );

  it.effect("delete soft-revokes; a second delete fails NotFound; findManyByUser hides it", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      yield* repo.insertOne(make(idA, { hash: "a" }));
      yield* repo.deleteOne(idA);
      deepStrictEqual((yield* repo.findOneById(idA)).revokedAt !== null, true);
      deepStrictEqual((yield* repo.findManyByUser(userId)).length, 0);
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
      deepStrictEqual((yield* repo.findOneById(idA)).lastUsedAt, later);

      yield* repo.deleteOne(idA);
      const exit = yield* Effect.exit(
        repo.updateOne(ApiTokenRootOps.touch({ token: seed, now: later })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(provide),
  );
});
