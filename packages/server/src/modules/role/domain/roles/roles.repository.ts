import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type RolesRoot } from "@/modules/role/domain/roles/roles.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";

// Dumb persistence, collapsed to upsert + spec-based read. The aggregate is
// multi-row (one `platform.roles` row per granted role) keyed on `userId`.
// `findOne` compiles the spec to a WHERE, fetches the matching rows, and
// reconstitutes ONE aggregate — or `null` when no rows match. "No rows" is a
// valid "no roles granted yet" state, so the caller maps `null` to
// `RolesRootOps.empty(...)`: the empty aggregate is a domain concern the repo
// can't synthesize from zero rows.
export type RolesRepositoryShape = {
  readonly upsertOne: (roles: RolesRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<RolesRoot>,
  ) => Effect.Effect<RolesRoot | null, PersistenceUnavailable>;
};

export class RolesRepository extends Context.Service<RolesRepository, RolesRepositoryShape>()(
  "RolesRepository",
) {}
