import * as Result from "effect/Result";

import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

import {
  AlreadyHasOrganizationRole,
  DoesNotHaveOrganizationRole,
} from "./organization-role.errors.js";
import {
  type OrganizationRoleEvent,
  OrganizationRoleGranted,
  OrganizationRoleRevoked,
} from "./organization-role.events.js";
import { type OrganizationRoleValueObject } from "./organization-role.value-object.js";
import { IssuedRoleValueObject, OrganizationRolesRoot } from "./organization-roles.root.js";
import { OrganizationRolesSpecifications } from "./organization-roles.specification.js";

export type Outcome = {
  readonly organizationRoles: OrganizationRolesRoot;
  readonly events: ReadonlyArray<OrganizationRoleEvent>;
};

// Factory for the "no roles yet" case — used by the command handler
// when the repo's `findOneByUserIdAndOrgId` returns nothing.
const empty = (userId: UserId, organizationId: OrganizationId): OrganizationRolesRoot =>
  OrganizationRolesRoot.make({ userId, organizationId, roles: [] });

// Aggregate-protected invariant: a role can only be granted once.
const grantRole = (
  aggregate: OrganizationRolesRoot,
  role: OrganizationRoleValueObject,
  issuedBy: UserId,
): Result.Result<Outcome, AlreadyHasOrganizationRole> => {
  if (OrganizationRolesSpecifications.hasRole(aggregate, role)) {
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
  if (!OrganizationRolesSpecifications.hasRole(aggregate, role)) {
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

export const OrganizationRolesRootOps = { empty, grantRole, revokeRole } as const;
