import { type CallerCheck } from "@org/authz";
import { type CurrentUser } from "@org/contracts/Policy";
import { type PersistenceUnavailable } from "@org/cqrs";

import { type PlatformRoles } from "@/modules/organization/domain/ports/acl/platform-roles.acl.js";

// Super-admin bypass, owned by this module rather than shared from platform:
// each module asks the role module through its own port, so extracting the
// organization module into its own service would not leave a platform-level
// dependency behind.
//
// Declared as a `CallerCheck` (caller only) so one instance composes into both
// the scoped `organization` resource and the unscoped `organizationCollection`.
export const makeIsOrgSuperAdmin =
  (roles: PlatformRoles["Service"]): CallerCheck<CurrentUser["Service"], PersistenceUnavailable> =>
  (caller) =>
    roles.isSuperAdmin(caller.userId);
