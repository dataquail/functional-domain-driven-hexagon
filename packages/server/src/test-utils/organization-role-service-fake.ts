import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type OrganizationRoleName,
  OrganizationRoleService,
} from "@/platform/ddd/organization-role-service.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Factory for an in-memory `OrganizationRoleService` Layer keyed by a
// `${userId}::${organizationId}` composite. Use in unit tests of
// policies / checks that depend on per-org roles, where you don't want
// to wire the repository + query bus + plumbing to validate a boolean
// predicate.
export const makeOrganizationRoleServiceFake = (
  rolesByPair: ReadonlyMap<
    `${UserId}::${OrganizationId}`,
    ReadonlyArray<OrganizationRoleName>
  > = new Map(),
) =>
  Layer.succeed(
    OrganizationRoleService,
    OrganizationRoleService.of({
      findOrganizationPermissions: (userId, organizationId) =>
        Effect.succeed({
          userId,
          organizationId,
          roles: rolesByPair.get(`${userId}::${organizationId}`) ?? [],
        }),
    }),
  );
