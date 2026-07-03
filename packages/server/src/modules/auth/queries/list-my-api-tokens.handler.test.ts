import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { ApiTokenId } from "@/modules/auth/domain/api-token.id.js";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token.root.js";
import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token.repository.js";
import { ApiTokenRepositoryFake } from "@/modules/auth/infrastructure/repositories/api-token.repository-fake.js";
import { listMyApiTokens } from "@/modules/auth/queries/list-my-api-tokens.handler.js";
import { ListMyApiTokensQuery } from "@/modules/auth/queries/list-my-api-tokens.query.js";
import { UserId } from "@/platform/ids/user-id.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const otherUserId = UserId.make("22222222-2222-2222-2222-222222222222");
const idA = ApiTokenId.make("33333333-3333-3333-3333-333333333333");
const idOther = ApiTokenId.make("44444444-4444-4444-4444-444444444444");

const provide = Effect.provide(ApiTokenRepositoryFake);

describe("listMyApiTokens", () => {
  it.effect("returns only the caller's tokens", () =>
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;
      const now = yield* DateTime.now;
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
    }).pipe(provide),
  );
});
