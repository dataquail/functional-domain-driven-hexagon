import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRoleValueObject } from "./organization-role.value-object.js";

// One role assignment for a (user, org) pair, carrying the audit trail
// of who issued it. The aggregate models this as a record (not just a
// role name) so the DELETE-then-INSERT-all save in the repository
// round-trips `issued_by` rather than dropping it on every re-save.
export class IssuedRoleValueObject extends Schema.Class<IssuedRoleValueObject>(
  "IssuedRoleValueObject",
)({
  role: OrganizationRoleValueObject,
  issuedBy: UserId,
}) {}

// Aggregate root data — a dumb value (ADR-0003). Operations live in
// `organization-roles.root-ops.ts` (`OrganizationRolesRootOps`) and
// predicates in `organization-roles.specification.ts`
// (`OrganizationRolesSpecifications`).
//
// The set of roles assigned to one user within one organization.
// Aggregate root, identified by the composite `(userId, organizationId)`.
// Modeled as an array at the schema layer for stable serialization but
// treated as a set semantically — `grantRole` / `revokeRole` enforce
// uniqueness on the `role` axis. Mirrors `RolesRoot` in the role module,
// scoped to an organization plus an audit column.
export class OrganizationRolesRoot extends Schema.Class<OrganizationRolesRoot>(
  "OrganizationRolesRoot",
)({
  userId: UserId,
  organizationId: OrganizationId,
  roles: Schema.Array(IssuedRoleValueObject),
}) {}
