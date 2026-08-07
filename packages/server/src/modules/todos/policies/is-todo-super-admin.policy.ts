import { type CurrentUser } from "@org/contracts/Policy";
import { type PersistenceUnavailable } from "@org/cqrs";

import { type PlatformRoles } from "@/modules/todos/domain/ports/acl/platform-roles.acl.js";
import { type CallerCheck } from "@/platform/auth/check.js";

// Super-admin bypass, owned by this module rather than shared from platform:
// each module asks the role module through its own port, so extracting todos
// into its own service would not leave a platform-level dependency behind.
//
// Declared as a `CallerCheck` (caller only) so one instance composes into both
// the scoped todo resources and any unscoped resource this module might add.
export const makeIsTodoSuperAdmin =
  (roles: PlatformRoles["Service"]): CallerCheck<CurrentUser["Service"], PersistenceUnavailable> =>
  (caller) =>
    roles.isSuperAdmin(caller.userId);
