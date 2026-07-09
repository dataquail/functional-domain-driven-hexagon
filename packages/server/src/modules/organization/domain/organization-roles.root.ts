import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import {
  AlreadyHasOrganizationRole,
  DoesNotHaveOrganizationRole,
} from "./organization-role.errors.js";
import {
  type OrganizationRoleEvent,
  OrganizationRoleGranted,
  OrganizationRoleRevoked,
} from "./organization-role.events.js";
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

export type Outcome = {
  readonly organizationRoles: OrganizationRolesRoot;
  readonly events: ReadonlyArray<OrganizationRoleEvent>;
};

// Factory for the "no roles yet" case — used by the command handler
// when the repo's `findOneByUserIdAndOrgId` returns nothing.
const empty = (userId: UserId, organizationId: OrganizationId): OrganizationRolesRoot =>
  OrganizationRolesRoot.make({ userId, organizationId, roles: [] });

const hasRole = (aggregate: OrganizationRolesRoot, role: OrganizationRoleValueObject): boolean =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- comparison is provably constant while `OrganizationRoleValueObject` has a single literal; becomes a real comparison once a second role lands.
  aggregate.roles.some((r) => r.role === role);

// Aggregate-protected invariant: a role can only be granted once.
const grantRole = (
  aggregate: OrganizationRolesRoot,
  role: OrganizationRoleValueObject,
  issuedBy: UserId,
): Result.Result<Outcome, AlreadyHasOrganizationRole> => {
  if (hasRole(aggregate, role)) {
    return Result.fail(
      new AlreadyHasOrganizationRole({
        userId: aggregate.userId,
        organizationId: aggregate.organizationId,
        role,
      }),
    );
  }
  return Result.succeed({
    organizationRoles: OrganizationRolesRoot.make({
      userId: aggregate.userId,
      organizationId: aggregate.organizationId,
      roles: [...aggregate.roles, IssuedRoleValueObject.make({ role, issuedBy })],
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
const revokeRole = (
  aggregate: OrganizationRolesRoot,
  role: OrganizationRoleValueObject,
): Result.Result<Outcome, DoesNotHaveOrganizationRole> => {
  if (!hasRole(aggregate, role)) {
    return Result.fail(
      new DoesNotHaveOrganizationRole({
        userId: aggregate.userId,
        organizationId: aggregate.organizationId,
        role,
      }),
    );
  }
  return Result.succeed({
    organizationRoles: OrganizationRolesRoot.make({
      userId: aggregate.userId,
      organizationId: aggregate.organizationId,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- filter is provably constant while `OrganizationRoleValueObject` has a single literal; becomes a real filter once a second role lands.
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

export const OrganizationRolesRootOps = { empty, hasRole, grantRole, revokeRole } as const;
