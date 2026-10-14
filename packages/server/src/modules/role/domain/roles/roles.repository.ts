import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable.js";
import { type Specification } from "@/globals/application/ddd/specification.js";
import { type RolesRoot } from "@/modules/role/domain/roles/roles.root.js";

// Dumb persistence, collapsed to upsert + spec-based read. The aggregate is
// multi-row (one `platform.roles` row per granted role) keyed on `userId`.
// `findOne` compiles the spec to a WHERE, fetches the matching rows, and
// reconstitutes ONE aggregate — or `None` when no rows match. "No rows" is a
// valid "no roles granted yet" state, so the caller maps `None` to
// `RolesRootOps.empty(...)`: the empty aggregate is a domain concern the repo
// can't synthesize from zero rows.
export type RolesRepositoryService = {
  readonly upsertOne: (roles: RolesRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<RolesRoot>,
  ) => Effect.Effect<Option.Option<RolesRoot>, PersistenceUnavailable>;
};

export class RolesRepository extends Context.Service<RolesRepository, RolesRepositoryService>()(
  "RolesRepository",
) {}
