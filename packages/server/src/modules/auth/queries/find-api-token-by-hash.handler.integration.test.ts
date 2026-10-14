import { deepStrictEqual } from "node:assert";

import { assertInstanceOf } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as TestClock from "effect/testing/TestClock";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.js";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token/api-token.root-ops.js";
import { ApiTokenRepositoryLive } from "@/modules/auth/infrastructure/repositories/api-token.repository-live.js";
import { findApiTokenByHashHandler } from "@/modules/auth/queries/find-api-token-by-hash.handler.js";
import {
  ApiTokenExpired,
  ApiTokenNotFound,
  ApiTokenRevoked,
} from "@/modules/auth/queries/find-api-token-by-hash.query.js";
import { describeIntegration } from "@/test-utils/server-test-runtime.js";
import { TestDatabaseLive } from "@/test-utils/test-database.js";

const apiTokenId = ApiTokenId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");

// The handler reads `DateTime.now`; each test pins a TestClock to a fixed instant so
// expiry assertions ("future"/"past") are deterministic.
const clockNow = DateTime.makeUnsafe("2026-06-01T00:00:00Z");
const future = DateTime.makeUnsafe("2099-01-01T00:00:00Z");
const past = DateTime.makeUnsafe("2020-01-01T00:00:00Z");

const TestLayer = ApiTokenRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seedUser = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'owner@example.com', 'USA', '123 Main St', '12345', now(), now())
      `.pipe(Effect.orDie);
});

const insert = (opts: { expiresAt: DateTime.Utc; revokedAt?: DateTime.Utc }) =>
  Effect.gen(function* () {
    const repo = yield* ApiTokenRepository;
    yield* repo.insertOne(
      ApiTokenRootOps.mint({
        id: apiTokenId,
        userId,
        tokenHash: "hash-A",
        prefix: "pat_abcd1234",
        label: "ci",
        expiresAt: Option.some(opts.expiresAt),
        now: clockNow,
      }),
    );
    const revokedAt = Option.fromUndefinedOr(opts.revokedAt);

    if (Option.isSome(revokedAt)) {
      // Revocation isn't a mint-time concern, and the live repo's write
      // surface doesn't expose it — stamp `revoked_at` directly.
      const sql = yield* Database.Database;
      yield* sql`
            UPDATE auth.api_tokens SET revoked_at = ${DateTime.toDate(revokedAt.value)}
            WHERE id = ${apiTokenId}
          `.pipe(Effect.orDie);
    }
  });

describeIntegration(
  "findApiTokenByHashHandler (integration)",
  { layer: TestLayer, tables: ["auth.api_tokens", "user.users"] },
  (it) => {
    it.effect("returns an active token", () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
        yield* seedUser;
        yield* insert({ expiresAt: future });
        const token = yield* findApiTokenByHashHandler({ tokenHash: "hash-A" });
        deepStrictEqual(token.id, apiTokenId);
      }).pipe(Effect.provide(TestClock.layer())),
    );

    it.effect("fails ApiTokenNotFound for an unknown hash", () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
        assertInstanceOf(
          yield* Effect.flip(findApiTokenByHashHandler({ tokenHash: "missing" })),
          ApiTokenNotFound,
        );
      }).pipe(Effect.provide(TestClock.layer())),
    );

    it.effect("fails ApiTokenRevoked when the token is revoked", () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
        yield* seedUser;
        yield* insert({ expiresAt: future, revokedAt: clockNow });
        assertInstanceOf(
          yield* Effect.flip(findApiTokenByHashHandler({ tokenHash: "hash-A" })),
          ApiTokenRevoked,
        );
      }).pipe(Effect.provide(TestClock.layer())),
    );

    it.effect("fails ApiTokenExpired when past the expiry instant", () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
        yield* seedUser;
        yield* insert({ expiresAt: past });
        assertInstanceOf(
          yield* Effect.flip(findApiTokenByHashHandler({ tokenHash: "hash-A" })),
          ApiTokenExpired,
        );
      }).pipe(Effect.provide(TestClock.layer())),
    );
  },
);
