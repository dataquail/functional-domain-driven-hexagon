import * as Either from "effect/Either";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRole } from "./organization-role.js";
import {
  AlreadyHasOrganizationRole,
  DoesNotHaveOrganizationRole,
} from "./organization-role-errors.js";
import {
  type OrganizationRoleEvent,
  OrganizationRoleGranted,
  OrganizationRoleRevoked,
} from "./organization-role-events.js";

// One role assignment for a (user, org) pair, carrying the audit trail
// of who issued it. The aggregate models this as a record (not just a
// role name) so the DELETE-then-INSERT-all save in the repository
// round-trips `issued_by` rather than dropping it on every re-save.
export class IssuedRole extends Schema.Class<IssuedRole>("IssuedRole")({
  role: OrganizationRole,
  issuedBy: UserId,
}) {}

// The set of roles assigned to one user within one organization.
// Aggregate root, identified by the composite `(userId, organizationId)`.
// Modeled as an array at the schema layer for stable serialization but
// treated as a set semantically — `grantRole` / `revokeRole` enforce
// uniqueness on the `role` axis. Mirrors `Roles` in the role module,
// scoped to an organization plus an audit column.
export class OrganizationRoles extends Schema.Class<OrganizationRoles>("OrganizationRoles")({
  userId: UserId,
  organizationId: OrganizationId,
  roles: Schema.Array(IssuedRole),
}) {}

export type Result = {
  readonly organizationRoles: OrganizationRoles;
  readonly events: ReadonlyArray<OrganizationRoleEvent>;
};

// Factory for the "no roles yet" case — used by the command handler
// when the repo's `findOneByUserIdAndOrgId` returns nothing.
export const empty = (userId: UserId, organizationId: OrganizationId): OrganizationRoles =>
  OrganizationRoles.make({ userId, organizationId, roles: [] });

export const hasRole = (aggregate: OrganizationRoles, role: OrganizationRole): boolean =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- comparison is provably constant while `OrganizationRole` has a single literal; becomes a real comparison once a second role lands.
  aggregate.roles.some((r) => r.role === role);

// Aggregate-protected invariant: a role can only be granted once.
export const grantRole = (
  aggregate: OrganizationRoles,
  role: OrganizationRole,
  issuedBy: UserId,
): Either.Either<Result, AlreadyHasOrganizationRole> => {
  if (hasRole(aggregate, role)) {
    return Either.left(
      new AlreadyHasOrganizationRole({
        userId: aggregate.userId,
        organizationId: aggregate.organizationId,
        role,
      }),
    );
  }
  return Either.right({
    organizationRoles: OrganizationRoles.make({
      userId: aggregate.userId,
      organizationId: aggregate.organizationId,
      roles: [...aggregate.roles, IssuedRole.make({ role, issuedBy })],
    }),
    events: [
      OrganizationRoleGranted.make({
        userId: aggregate.userId,
        organizationId: aggregate.organizationId,
        role,
        issuedBy,
      }),
    ],
  });
};

// Aggregate-protected invariant: only a role currently held can be
// revoked.
export const revokeRole = (
  aggregate: OrganizationRoles,
  role: OrganizationRole,
): Either.Either<Result, DoesNotHaveOrganizationRole> => {
  if (!hasRole(aggregate, role)) {
    return Either.left(
      new DoesNotHaveOrganizationRole({
        userId: aggregate.userId,
        organizationId: aggregate.organizationId,
        role,
      }),
    );
  }
  return Either.right({
    organizationRoles: OrganizationRoles.make({
      userId: aggregate.userId,
      organizationId: aggregate.organizationId,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- filter is provably constant while `OrganizationRole` has a single literal; becomes a real filter once a second role lands.
      roles: aggregate.roles.filter((r) => r.role !== role),
    }),
    events: [
      OrganizationRoleRevoked.make({
        userId: aggregate.userId,
        organizationId: aggregate.organizationId,
        role,
      }),
    ],
  });
};
