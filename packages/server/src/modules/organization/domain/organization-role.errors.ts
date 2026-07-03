import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRoleValueObject } from "./organization-role.value-object.js";

// Aggregate invariant: a role can only be granted once per (user,
// organization). Surfaces from `OrganizationRoles.grantRole` and is
// translated to a 409-style conflict (or absorbed as idempotent) at
// the command boundary.
export class AlreadyHasOrganizationRole extends Schema.TaggedError<AlreadyHasOrganizationRole>(
  "AlreadyHasOrganizationRole",
)("AlreadyHasOrganizationRole", {
  userId: UserId,
  organizationId: OrganizationId,
  role: OrganizationRoleValueObject,
}) {}

// Aggregate invariant: a role can only be revoked if it is currently
// held. Surfaces from `OrganizationRoles.revokeRole`.
export class DoesNotHaveOrganizationRole extends Schema.TaggedError<DoesNotHaveOrganizationRole>(
  "DoesNotHaveOrganizationRole",
)("DoesNotHaveOrganizationRole", {
  userId: UserId,
  organizationId: OrganizationId,
  role: OrganizationRoleValueObject,
}) {}

// Command-level domain invariant: the actor of a role grant cannot be
// the target. Mirrors the role module's `CannotPromoteSelf` — prevents
// an actor from promoting themselves regardless of the policy layer's
// decision. The HTTP endpoint translates this to a 403 Forbidden.
export class CannotPromoteSelfInOrganization extends Schema.TaggedError<CannotPromoteSelfInOrganization>(
  "CannotPromoteSelfInOrganization",
)("CannotPromoteSelfInOrganization", {
  userId: UserId,
  organizationId: OrganizationId,
}) {}
