import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type OrganizationRolesRoot } from "@/modules/organization/domain/organization-roles/organization-roles.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Dumb persistence port. The aggregate carries the invariants
// (uniqueness, "revoke only what's held"); the repository only knows
// how to save and fetch the resulting state.
//
// `findOneByUserIdAndOrgId` returns an empty `OrganizationRolesRoot` aggregate
// if no rows are stored — the absence of any rows is a valid "no roles
// yet" state, not a NotFound condition. Mirrors `RolesRepository`.
export type OrganizationRolesRepositoryShape = {
  readonly upsertOne: (
    organizationRoles: OrganizationRolesRoot,
  ) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOneByUserIdAndOrgId: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<OrganizationRolesRoot, PersistenceUnavailable>;
};

export class OrganizationRolesRepository extends Context.Service<
  OrganizationRolesRepository,
  OrganizationRolesRepositoryShape
>()("OrganizationRolesRepository") {}
