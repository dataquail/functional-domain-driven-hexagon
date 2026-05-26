import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

import { type OrganizationRoles } from "./organization-roles.aggregate.js";

// Dumb persistence port. The aggregate carries the invariants
// (uniqueness, "revoke only what's held"); the repository only knows
// how to save and fetch the resulting state.
//
// `findByUserIdAndOrgId` returns an empty `OrganizationRoles` aggregate
// if no rows are stored — the absence of any rows is a valid "no roles
// yet" state, not a NotFound condition. Mirrors `RolesRepository`.
export type OrganizationRolesRepositoryShape = {
  readonly save: (
    organizationRoles: OrganizationRoles,
  ) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findByUserIdAndOrgId: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<OrganizationRoles, PersistenceUnavailable>;
};

export class OrganizationRolesRepository extends Context.Tag("OrganizationRolesRepository")<
  OrganizationRolesRepository,
  OrganizationRolesRepositoryShape
>() {}
