import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";

import { type UserId } from "@/platform/ids/user-id.js";

import { ApiToken } from "../domain/api-token.aggregate.js";
import { ApiTokenNotFound } from "../domain/api-token-errors.js";
import { type ApiTokenId } from "../domain/api-token-id.js";
import { ApiTokenRepository } from "../domain/ports/repositories/api-token-repository.js";

export const ApiTokenRepositoryFake = Layer.effect(
  ApiTokenRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<ApiTokenId, ApiToken>());

    const insertOne = (token: ApiToken): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(token.id, token));

    const findOneById = (id: ApiTokenId): Effect.Effect<ApiToken, ApiTokenNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.match(HashMap.get(m, id), {
          onNone: () => Effect.fail(new ApiTokenNotFound()),
          onSome: Effect.succeed,
        }),
      );

    const findOneByHash = (tokenHash: string): Effect.Effect<ApiToken, ApiTokenNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const match = Array.from(HashMap.values(m)).find((t) => t.tokenHash === tokenHash);
        return match === undefined ? Effect.fail(new ApiTokenNotFound()) : Effect.succeed(match);
      });

    // Active (non-revoked) tokens, newest first — mirrors the live SQL.
    const findManyByUser = (userId: UserId): Effect.Effect<ReadonlyArray<ApiToken>> =>
      Effect.map(Ref.get(store), (m) =>
        Array.from(HashMap.values(m))
          .filter((t) => t.userId === userId && t.revokedAt === null)
          .sort(Order.reverse(Order.mapInput(DateTime.Order, (t: ApiToken) => t.createdAt))),
      );

    // Mirrors the live impl: a re-delete on an already-revoked token is
    // reported as ApiTokenNotFound (the SQL UPDATE matches `WHERE revoked_at
    // IS NULL`, so the second call returns zero rows and `orFail` raises).
    const deleteToken = (id: ApiTokenId): Effect.Effect<void, ApiTokenNotFound> =>
      Effect.gen(function* () {
        const m = yield* Ref.get(store);
        const existing = HashMap.get(m, id);
        if (Option.isNone(existing) || existing.value.revokedAt !== null) {
          return yield* Effect.fail(new ApiTokenNotFound());
        }
        const now = yield* DateTime.now;
        yield* Ref.update(
          store,
          HashMap.set(id, ApiToken.make({ ...existing.value, revokedAt: now })),
        );
      });

    // Mirrors the live impl: only updates rows where revoked_at IS NULL.
    const updateOne = (token: ApiToken): Effect.Effect<void, ApiTokenNotFound> =>
      Effect.gen(function* () {
        const m = yield* Ref.get(store);
        const existing = HashMap.get(m, token.id);
        if (Option.isNone(existing) || existing.value.revokedAt !== null) {
          return yield* Effect.fail(new ApiTokenNotFound());
        }
        yield* Ref.update(
          store,
          HashMap.set(token.id, ApiToken.make({ ...existing.value, lastUsedAt: token.lastUsedAt })),
        );
      });

    return ApiTokenRepository.of({
      insertOne,
      findOneById,
      findOneByHash,
      findManyByUser,
      deleteOne: deleteToken,
      updateOne,
    });
  }),
);
