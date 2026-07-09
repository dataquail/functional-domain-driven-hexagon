import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type ApiTokenNotFound } from "@/modules/auth/domain/api-token.errors.js";
import { type ApiTokenId } from "@/modules/auth/domain/api-token.id.js";
import { type ApiTokenRoot } from "@/modules/auth/domain/api-token.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Dumb collection port (per `feedback_dumb_repositories`): save / findByX
// only. Domain verbs (mint, revoke, touch) live in the use cases and the
// aggregate; the soft-delete storage mechanism behind `delete` is an
// implementation detail.
export type ApiTokenRepositoryShape = {
  readonly insertOne: (token: ApiTokenRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOneById: (
    id: ApiTokenId,
  ) => Effect.Effect<ApiTokenRoot, ApiTokenNotFound | PersistenceUnavailable>;
  // Per-request lookup of the presented bearer (already hashed by the
  // caller — the raw secret never reaches the repository).
  readonly findOneByHash: (
    tokenHash: string,
  ) => Effect.Effect<ApiTokenRoot, ApiTokenNotFound | PersistenceUnavailable>;
  // Active (non-revoked) tokens for the owner's management listing.
  readonly findManyByUser: (
    userId: UserId,
  ) => Effect.Effect<ReadonlyArray<ApiTokenRoot>, PersistenceUnavailable>;
  // Soft-delete via `revoked_at` (SQL `WHERE revoked_at IS NULL`). A
  // re-revoke matches zero rows and surfaces as `ApiTokenNotFound`, same as
  // a genuine miss — both mean "no active token to revoke" to the caller.
  // (`ApiTokenRevoked` is produced by the find-by-hash query, not here.)
  readonly deleteOne: (
    id: ApiTokenId,
  ) => Effect.Effect<void, ApiTokenNotFound | PersistenceUnavailable>;
  readonly updateOne: (
    token: ApiTokenRoot,
  ) => Effect.Effect<void, ApiTokenNotFound | PersistenceUnavailable>;
};

export class ApiTokenRepository extends Context.Service<
  ApiTokenRepository,
  ApiTokenRepositoryShape
>()("ApiTokenRepository") {}
