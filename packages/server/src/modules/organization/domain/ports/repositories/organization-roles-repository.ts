import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type OrganizationRoles } from "@/modules/organization/domain/organization-roles.aggregate.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Dumb persistence port. The aggregate carries the invariants
// (uniqueness, "revoke only what's held"); the repository only knows
// how to save and fetch the resulting state.
//
// `findOneByUserIdAndOrgId` returns an empty `OrganizationRoles` aggregate
// if no rows are stored — the absence of any rows is a valid "no roles
// yet" state, not a NotFound condition. Mirrors `RolesRepository`.
export type OrganizationRolesRepositoryShape = {
  readonly upsertOne: (
    organizationRoles: OrganizationRoles,
  ) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOneByUserIdAndOrgId: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<OrganizationRoles, PersistenceUnavailable>;
};

export class OrganizationRolesRepository extends Context.Tag("OrganizationRolesRepository")<
  OrganizationRolesRepository,
  OrganizationRolesRepositoryShape
>() {}
