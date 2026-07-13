import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";

import { ApiTokenNotFound } from "@/modules/auth/domain/api-token/api-token.errors.js";
import { type ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.js";
import { ApiTokenRoot } from "@/modules/auth/domain/api-token/api-token.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";

export const ApiTokenRepositoryFake = Layer.effect(
  ApiTokenRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<ApiTokenId, ApiTokenRoot>());

    const insertOne = (token: ApiTokenRoot): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(token.id, token));

    // The spec IS the in-memory predicate — the same object the live repo
    // compiles to SQL — so fake and live agree by construction.
    const findOne = (spec: Specification<ApiTokenRoot>): Effect.Effect<ApiTokenRoot | null> =>
      Effect.map(Ref.get(store), (m) => Array.from(HashMap.values(m)).find(spec) ?? null);

    // Newest first, mirroring the live repo's `ORDER BY created_at DESC`.
    const findMany = (
      spec: Specification<ApiTokenRoot>,
    ): Effect.Effect<ReadonlyArray<ApiTokenRoot>> =>
      Effect.map(Ref.get(store), (m) =>
        Array.from(HashMap.values(m))
          .filter(spec)
          .sort(Order.flip(Order.mapInput(DateTime.Order, (t: ApiTokenRoot) => t.createdAt))),
      );

    // Mirrors the live impl: a re-delete on an already-revoked token is
    // reported as ApiTokenNotFound (the SQL UPDATE matches `WHERE revoked_at
    // IS NULL`, so the second call returns zero rows and `orFail` raises).
    const deleteToken = (id: ApiTokenId): Effect.Effect<void, ApiTokenNotFound> =>
      Effect.gen(function* () {
        const m = yield* Ref.get(store);
        const existing = HashMap.get(m, id);
        if (Option.isNone(existing) || existing.value.revokedAt !== null) {
          return yield* new ApiTokenNotFound();
        }
        const now = yield* DateTime.now;
        yield* Ref.update(
          store,
          HashMap.set(id, ApiTokenRoot.make({ ...existing.value, revokedAt: now })),
        );
      });

    // Mirrors the live impl: only updates rows where revoked_at IS NULL.
    const updateOne = (token: ApiTokenRoot): Effect.Effect<void, ApiTokenNotFound> =>
      Effect.gen(function* () {
        const m = yield* Ref.get(store);
        const existing = HashMap.get(m, token.id);
        if (Option.isNone(existing) || existing.value.revokedAt !== null) {
          return yield* new ApiTokenNotFound();
        }
        yield* Ref.update(
          store,
          HashMap.set(
            token.id,
            ApiTokenRoot.make({ ...existing.value, lastUsedAt: token.lastUsedAt }),
          ),
        );
      });

    return ApiTokenRepository.of({
      insertOne,
      findOne,
      findMany,
      deleteOne: deleteToken,
      updateOne,
    });
  }),
);
