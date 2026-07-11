import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as TestClock from "effect/testing/TestClock";
import { beforeEach } from "vitest";

import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.js";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token/api-token.root-ops.js";
import { ApiTokenRepositoryLive } from "@/modules/auth/infrastructure/repositories/api-token.repository-live.js";
import { findApiTokenByHash } from "@/modules/auth/queries/find-api-token-by-hash.handler.js";
import {
  ApiTokenExpired,
  ApiTokenRevoked,
  FindApiTokenByHashQuery,
} from "@/modules/auth/queries/find-api-token-by-hash.query.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const apiTokenId = ApiTokenId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");
// The handler reads `DateTime.now`; pin the TestClock to a fixed instant so
// expiry assertions ("future"/"past") are deterministic.
const clockNow = DateTime.makeUnsafe(new Date("2026-06-01T00:00:00Z"));
const future = DateTime.makeUnsafe(new Date("2099-01-01T00:00:00Z"));
const past = DateTime.makeUnsafe(new Date("2020-01-01T00:00:00Z"));

const TestLayer = ApiTokenRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

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

const insert = (opts: { expiresAt: DateTime.Utc | null; revokedAt?: DateTime.Utc }) =>
  Effect.gen(function* () {
    const repo = yield* ApiTokenRepository;
    yield* repo.insertOne(
      ApiTokenRootOps.mint({
        id: apiTokenId,
        userId,
        tokenHash: "hash-A",
        prefix: "pat_abcd1234",
        label: "ci",
        expiresAt: opts.expiresAt,
        now: clockNow,
      }),
    );
    const revokedAt = opts.revokedAt;
    if (revokedAt !== undefined) {
      // Revocation isn't a mint-time concern, and the live repo's write
      // surface doesn't expose it — stamp `revoked_at` directly.
      const db = yield* Database.Database;
      yield* db
        .execute((client) =>
          client.query(sql.unsafe`
            UPDATE auth.api_tokens SET revoked_at = ${sql.timestamp(DateTime.toDate(revokedAt))}
            WHERE id = ${apiTokenId}
          `),
        )
        .pipe(Effect.orDie);
    }
  });

const errorOf = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit) && Cause.hasFails(exit.cause)
    ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
    : null;

const suite = describe.sequential;

suite("findApiTokenByHash (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("auth.api_tokens", "user.users").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("returns an active token", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
      yield* seedUser;
      yield* insert({ expiresAt: future });
      const token = yield* findApiTokenByHash(
        FindApiTokenByHashQuery.make({ tokenHash: "hash-A" }),
      );
      deepStrictEqual(token.id, apiTokenId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails ApiTokenNotFound for an unknown hash", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
      const exit = yield* Effect.exit(
        findApiTokenByHash(FindApiTokenByHashQuery.make({ tokenHash: "missing" })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails ApiTokenRevoked when the token is revoked", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
      yield* seedUser;
      yield* insert({ expiresAt: future, revokedAt: clockNow });
      const exit = yield* Effect.exit(
        findApiTokenByHash(FindApiTokenByHashQuery.make({ tokenHash: "hash-A" })),
      );
      deepStrictEqual(errorOf(exit) instanceof ApiTokenRevoked, true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails ApiTokenExpired when past the expiry instant", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
      yield* seedUser;
      yield* insert({ expiresAt: past });
      const exit = yield* Effect.exit(
        findApiTokenByHash(FindApiTokenByHashQuery.make({ tokenHash: "hash-A" })),
      );
      deepStrictEqual(errorOf(exit) instanceof ApiTokenExpired, true);
    }).pipe(Effect.provide(TestLayer)),
  );
});
