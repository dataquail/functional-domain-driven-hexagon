import { deepStrictEqual } from "node:assert";

import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.ts";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.ts";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token/api-token.root-ops.ts";
import { ApiTokenRepositoryLive } from "@/modules/auth/infrastructure/repositories/api-token.repository-live.ts";
import { listMyApiTokensHandler } from "@/modules/auth/queries/list-my-api-tokens.handler.ts";
import { describeIntegration } from "@/test-utils/server-test-runtime.ts";
import { TestDatabaseLive } from "@/test-utils/test-database.ts";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const otherUserId = UserId.make("22222222-2222-2222-2222-222222222222");
const idA = ApiTokenId.make("33333333-3333-3333-3333-333333333333");
const idOther = ApiTokenId.make("44444444-4444-4444-4444-444444444444");
const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");

const TestLayer = ApiTokenRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const seedUsers = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES (${userId}, 'me@example.com', 'USA', '123 Main St', '12345', now(), now()),
               (${otherUserId}, 'other@example.com', 'USA', '456 Main St', '12345', now(), now())
      `.pipe(Effect.orDie);
});

describeIntegration(
  "listMyApiTokensHandler (integration)",
  { layer: TestLayer, tables: ["auth.api_tokens", "user.users"] },
  (it) => {
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
            expiresAt: Option.some(DateTime.add(now, { days: 90 })),
          });

        yield* repo.insertOne(mk(idA, userId));
        yield* repo.insertOne(mk(idOther, otherUserId));

        const mine = yield* listMyApiTokensHandler({ userId });
        deepStrictEqual(
          mine.map((t) => t.id),
          [idA],
        );
      }),
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
            expiresAt: Option.some(DateTime.add(now, { days: 90 })),
          }),
        );
        // deleteOne is the revoke path (stamps revoked_at); the query must
        // filter it out (WHERE revoked_at IS NULL).
        yield* repo.deleteOne(idA);

        const mine = yield* listMyApiTokensHandler({ userId });
        deepStrictEqual([...mine], []);
      }),
    );
  },
);
