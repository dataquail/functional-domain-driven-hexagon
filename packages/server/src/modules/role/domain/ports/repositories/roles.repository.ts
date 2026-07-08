import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type RolesRoot } from "@/modules/role/domain/roles.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Dumb persistence port. The aggregate carries the invariants; the
// repository only knows how to save and fetch the resulting state.
//
// `findOneByUserId` returns an empty `RolesRoot` aggregate if no roles are
// stored — the absence of any rows is a valid "no roles granted yet"
// state, not a NotFound condition.
export type RolesRepositoryShape = {
  readonly upsertOne: (roles: RolesRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOneByUserId: (userId: UserId) => Effect.Effect<RolesRoot, PersistenceUnavailable>;
};

export class RolesRepository extends Context.Service<RolesRepository, RolesRepositoryShape>()("RolesRepository") {}
