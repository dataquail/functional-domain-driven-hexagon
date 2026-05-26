import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

import { type Roles } from "./roles.aggregate.js";

// Dumb persistence port. The aggregate carries the invariants; the
// repository only knows how to save and fetch the resulting state.
//
// `findByUserId` returns an empty `Roles` aggregate if no roles are
// stored — the absence of any rows is a valid "no roles granted yet"
// state, not a NotFound condition.
export type RolesRepositoryShape = {
  readonly save: (roles: Roles) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findByUserId: (userId: UserId) => Effect.Effect<Roles, PersistenceUnavailable>;
};

export class RolesRepository extends Context.Tag("RolesRepository")<
  RolesRepository,
  RolesRepositoryShape
>() {}
