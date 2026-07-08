import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import { ApiTokenId } from "@/modules/auth/domain/api-token.id.js";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token.root.js";
import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token.repository.js";
import { ApiTokenRepositoryLive } from "@/modules/auth/infrastructure/repositories/api-token.repository-live.js";
import { listMyApiTokens } from "@/modules/auth/queries/list-my-api-tokens.handler.js";
import { ListMyApiTokensQuery } from "@/modules/auth/queries/list-my-api-tokens.query.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const otherUserId = UserId.make("22222222-2222-2222-2222-222222222222");
const idA = ApiTokenId.make("33333333-3333-3333-3333-333333333333");
const idOther = ApiTokenId.make("44444444-4444-4444-4444-444444444444");
const now = DateTime.unsafeMake(new Date("2026-01-01T00:00:00Z"));

const TestLayer = ApiTokenRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seedUsers = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'me@example.com', 'USA', '123 Main St', '12345', now(), now()),
               (${otherUserId}, 'other@example.com', 'USA', '456 Main St', '12345', now(), now())
      `),
    )
    .pipe(Effect.orDie);
});

const suite = describe.sequential;

suite("listMyApiTokens (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("auth.api_tokens", "user.users").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  it.effect("returns only the caller's tokens", () =>
    Effect.gen(function* () {
      yield* seedUsers;
      const repo = yield* ApiTokenRepository;
      const mk = (id: ApiTokenId, owner: UserId) =>
        ApiTokenRootOps.mint({
          id,
          userId: owner,
          tokenHash: `hash-${id}`,
          prefix: "pat_abcd1234",
          label: "ci",
          now,
          expiresAt: DateTime.add(now, { days: 90 }),
        });
      yield* repo.insertOne(mk(idA, userId));
      yield* repo.insertOne(mk(idOther, otherUserId));

      const mine = yield* listMyApiTokens(ListMyApiTokensQuery.make({ userId }));
      deepStrictEqual(
        mine.map((t) => t.id),
        [idA],
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("excludes revoked tokens", () =>
    Effect.gen(function* () {
      yield* seedUsers;
      const repo = yield* ApiTokenRepository;
      yield* repo.insertOne(
        ApiTokenRootOps.mint({
          id: idA,
          userId,
          tokenHash: "hash-live",
          prefix: "pat_abcd1234",
          label: "ci",
          now,
          expiresAt: DateTime.add(now, { days: 90 }),
        }),
      );
      // deleteOne is the revoke path (stamps revoked_at); the query must
      // filter it out (WHERE revoked_at IS NULL).
      yield* repo.deleteOne(idA);

      const mine = yield* listMyApiTokens(ListMyApiTokensQuery.make({ userId }));
      deepStrictEqual([...mine], []);
    }).pipe(Effect.provide(TestLayer)),
  );
});
