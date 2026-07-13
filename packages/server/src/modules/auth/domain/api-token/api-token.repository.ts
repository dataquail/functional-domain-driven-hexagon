import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type ApiTokenNotFound } from "@/modules/auth/domain/api-token/api-token.errors.js";
import { type ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { type ApiTokenRoot } from "@/modules/auth/domain/api-token/api-token.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";

// Dumb collection port (per `feedback_dumb_repositories`): insert/update the
// aggregate, delete by id, and read it back by a Specification. Domain verbs
// (mint, revoke, touch) live in the use cases and the aggregate; the
// soft-delete storage mechanism behind `delete` is an implementation detail.
// Every lookup — by id, by hash, the owner's active tokens — is expressed as a
// spec at the call site (ApiTokenSpecifications). Absence is a plain `null` /
// empty array; mapping it to ApiTokenNotFound is the caller's job.
export type ApiTokenRepositoryShape = {
  readonly insertOne: (token: ApiTokenRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<ApiTokenRoot>,
  ) => Effect.Effect<ApiTokenRoot | null, PersistenceUnavailable>;
  readonly findMany: (
    spec: Specification<ApiTokenRoot>,
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
