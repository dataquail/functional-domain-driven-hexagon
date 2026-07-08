import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// The set of org-scoped role names exposed to cross-module consumers.
// Deliberately a closed literal union here — duplicated from the org
// module's `OrganizationRole` Schema literal on purpose, so consuming
// modules (the org's own `IsOrgAdmin` check, future modules' policies)
// depend only on this ACL and not on the org module's domain types.
export type OrganizationRoleName = "admin";

export type OrganizationPermissions = {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly roles: ReadonlyArray<OrganizationRoleName>;
};

// Platform-layer ACL between the org module's `OrganizationRoles`
// aggregate and any policy that needs to ask "which roles does this
// user hold inside this org?" — e.g. `IsOrgAdmin`, future per-resource
// modules' admin checks. Mirrors `RoleService`'s shape, scoped to a
// (user, organization) pair instead of a platform-wide user.
export type OrganizationRoleServiceShape = {
  readonly findOrganizationPermissions: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<OrganizationPermissions, PersistenceUnavailable>;
};

export class OrganizationRoleService extends Context.Service<OrganizationRoleService, OrganizationRoleServiceShape>()("OrganizationRoleService") {}
