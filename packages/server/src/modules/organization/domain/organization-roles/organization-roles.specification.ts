import {
  type Predicate,
  Spec,
  type Specification,
} from "@/platform/ddd/contracts/specification.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

import { type OrganizationRoleValueObject } from "./organization-role.value-object.js";
import { type OrganizationRolesRoot } from "./organization-roles.root.js";

// Translatable identity specs — the composite key `(userId, organizationId)`
// lives on every row of the aggregate, so these compile to a WHERE that the
// repository uses to fetch the row set it reconstitutes into one aggregate.
const forUser = (userId: UserId): Specification<OrganizationRolesRoot> =>
  Spec.eq<OrganizationRolesRoot, "userId">("userId", userId);
const forOrganization = (organizationId: OrganizationId): Specification<OrganizationRolesRoot> =>
  Spec.eq<OrganizationRolesRoot, "organizationId">("organizationId", organizationId);

// Eval-only: `hasRole` reaches into the `roles` child collection, which the
// Criteria DSL cannot express (there is no "some child row" node). It is a
// Predicate, never a Specification, so it guards aggregate ops but can never be
// handed to a repository — the spec test locks that boundary at compile time.
const hasRole =
  (role: OrganizationRoleValueObject): Predicate<OrganizationRolesRoot> =>
  (aggregate) =>
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- comparison is provably constant while `OrganizationRoleValueObject` has a single literal; becomes a real comparison once a second role lands.
    aggregate.roles.some((r) => r.role === role);

export const OrganizationRolesSpecifications = { forUser, forOrganization, hasRole } as const;
