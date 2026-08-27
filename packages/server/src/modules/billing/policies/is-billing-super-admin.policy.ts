import { type CallerCheck } from "@effect-server-utils/authz";
import { type PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import { type CurrentUser } from "@org/contracts/Policy";

import { type PlatformRoles } from "@/modules/billing/domain/ports/acl/platform-roles.acl.js";

// Super-admin bypass, owned by this module rather than shared from platform:
// each module asks the role module through its own port, so extracting billing
// into its own service would not leave a platform-level dependency behind.
export const makeIsBillingSuperAdmin =
  (roles: PlatformRoles["Service"]): CallerCheck<CurrentUser["Service"], PersistenceUnavailable> =>
  (caller) =>
    roles.isSuperAdmin(caller.userId);
