import { type RoleValueObject } from "./role.value-object.js";
import { type RolesRoot } from "./roles.root.js";

const hasRole = (aggregate: RolesRoot, role: RoleValueObject): boolean =>
  aggregate.roles.includes(role);

export const RolesSpecifications = { hasRole } as const;
