import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { UserId } from "@/platform/ids/user-id.js";

import * as ApiToken from "../domain/api-token.aggregate.js";
import { ApiTokenNotFound } from "../domain/api-token-errors.js";
import { ApiTokenId } from "../domain/api-token-id.js";
import { ApiTokenRepository } from "../domain/ports/repositories/api-token-repository.js";
import { ApiTokenRepositoryFake } from "./api-token-repository-fake.js";

const idA = ApiTokenId.make("11111111-1111-1111-1111-111111111111");
const idB = ApiTokenId.make("22222222-2222-2222-2222-222222222222");
const idMissing = ApiTokenId.make("99999999-9999-9999-9999-999999999999");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const otherUserId = UserId.make("44444444-4444-4444-4444-444444444444");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const make = (id: ApiTokenId, opts: { userId?: UserId; hash?: string; createdAt?: DateTime.Utc }) =>
  ApiToken.mint({
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
  it.effect("insert + findById + findByHash round-trip", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      yield* repo.insert(make(idA, { hash: "hash-A" }));
      deepStrictEqual((yield* repo.findById(idA)).id, idA);
      deepStrictEqual((yield* repo.findByHash("hash-A")).id, idA);
    }).pipe(provide),
  );

  it.effect("findById / findByHash fail ApiTokenNotFound when absent", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      const byId = yield* Effect.exit(repo.findById(idMissing));
      const byHash = yield* Effect.exit(repo.findByHash("nope"));
      deepStrictEqual(Exit.isFailure(byId), true);
      deepStrictEqual(Exit.isFailure(byHash), true);
      if (Exit.isFailure(byId)) {
        const error = byId.cause._tag === "Fail" ? byId.cause.error : null;
        deepStrictEqual(error instanceof ApiTokenNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("listByUser returns only the caller's active tokens, newest first", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      yield* repo.insert(make(idA, { hash: "a", createdAt: now }));
      yield* repo.insert(make(idB, { hash: "b", createdAt: DateTime.add(now, { hours: 1 }) }));
      yield* repo.insert(make(idMissing, { userId: otherUserId, hash: "c" }));
      const mine = yield* repo.listByUser(userId);
      deepStrictEqual(
        mine.map((t) => t.id),
        [idB, idA],
      );
    }).pipe(provide),
  );

  it.effect("delete soft-revokes; a second delete fails NotFound; listByUser hides it", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      yield* repo.insert(make(idA, { hash: "a" }));
      yield* repo.delete(idA);
      deepStrictEqual((yield* repo.findById(idA)).revokedAt !== null, true);
      deepStrictEqual((yield* repo.listByUser(userId)).length, 0);
      const second = yield* Effect.exit(repo.delete(idA));
      deepStrictEqual(Exit.isFailure(second), true);
    }).pipe(provide),
  );

  it.effect("update advances lastUsedAt for an active token and fails NotFound when revoked", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      const seed = make(idA, { hash: "a" });
      yield* repo.insert(seed);
      const later = DateTime.add(now, { hours: 2 });
      yield* repo.update(ApiToken.touch({ token: seed, now: later }));
      deepStrictEqual((yield* repo.findById(idA)).lastUsedAt, later);

      yield* repo.delete(idA);
      const exit = yield* Effect.exit(repo.update(ApiToken.touch({ token: seed, now: later })));
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(provide),
  );
});
