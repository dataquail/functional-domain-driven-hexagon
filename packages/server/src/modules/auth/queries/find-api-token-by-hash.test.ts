import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { ApiToken } from "@/modules/auth/domain/api-token.aggregate.js";
import { ApiTokenExpired, ApiTokenRevoked } from "@/modules/auth/domain/api-token-errors.js";
import { ApiTokenId } from "@/modules/auth/domain/api-token-id.js";
import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token-repository.js";
import { ApiTokenRepositoryFake } from "@/modules/auth/infrastructure/api-token-repository-fake.js";
import { findApiTokenByHash } from "@/modules/auth/queries/find-api-token-by-hash.js";
import { FindApiTokenByHashQuery } from "@/modules/auth/queries/find-api-token-by-hash-query.js";
import { UserId } from "@/platform/ids/user-id.js";

const apiTokenId = ApiTokenId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");

const insert = (opts: { expiresAt: DateTime.Utc | null; revokedAt?: DateTime.Utc }) =>
  Effect.gen(function* () {
    const repo = yield* ApiTokenRepository;
    const now = yield* DateTime.now;
    yield* repo.insert(
      ApiToken.make({
        id: apiTokenId,
        userId,
        tokenHash: "hash-A",
        prefix: "pat_abcd1234",
        label: "ci",
        expiresAt: opts.expiresAt,
        revokedAt: opts.revokedAt ?? null,
        createdAt: now,
        lastUsedAt: now,
      }),
    );
  });

const provide = Effect.provide(ApiTokenRepositoryFake);
const errorOf = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit) && exit.cause._tag === "Fail" ? exit.cause.error : null;

describe("findApiTokenByHash", () => {
  it.effect("returns an active token", () =>
    Effect.gen(function* () {
      const future = DateTime.add(yield* DateTime.now, { days: 90 });
      yield* insert({ expiresAt: future });
      const token = yield* findApiTokenByHash(
        FindApiTokenByHashQuery.make({ tokenHash: "hash-A" }),
      );
      deepStrictEqual(token.id, apiTokenId);
    }).pipe(provide),
  );

  it.effect("fails ApiTokenNotFound for an unknown hash", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        findApiTokenByHash(FindApiTokenByHashQuery.make({ tokenHash: "missing" })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(provide),
  );

  it.effect("fails ApiTokenRevoked when the token is revoked", () =>
    Effect.gen(function* () {
      const now = yield* DateTime.now;
      yield* insert({ expiresAt: DateTime.add(now, { days: 90 }), revokedAt: now });
      const exit = yield* Effect.exit(
        findApiTokenByHash(FindApiTokenByHashQuery.make({ tokenHash: "hash-A" })),
      );
      deepStrictEqual(errorOf(exit) instanceof ApiTokenRevoked, true);
    }).pipe(provide),
  );

  it.effect("fails ApiTokenExpired when past the expiry instant", () =>
    Effect.gen(function* () {
      const past = DateTime.subtract(yield* DateTime.now, { days: 1 });
      yield* insert({ expiresAt: past });
      const exit = yield* Effect.exit(
        findApiTokenByHash(FindApiTokenByHashQuery.make({ tokenHash: "hash-A" })),
      );
      deepStrictEqual(errorOf(exit) instanceof ApiTokenExpired, true);
    }).pipe(provide),
  );
});
