import { type OrganizationRoleValueObject } from "./organization-role.value-object.js";
import { type OrganizationRolesRoot } from "./organization-roles.root.js";

const hasRole = (aggregate: OrganizationRolesRoot, role: OrganizationRoleValueObject): boolean =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- comparison is provably constant while `OrganizationRoleValueObject` has a single literal; becomes a real comparison once a second role lands.
  aggregate.roles.some((r) => r.role === role);

export const OrganizationRolesSpecifications = { hasRole } as const;
