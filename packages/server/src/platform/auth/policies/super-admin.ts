import { type CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { type Check } from "@/platform/auth/check.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { RoleService } from "@/platform/ddd/ports/role-service.js";

// Resource-agnostic baseline policy. Consumes the platform-layer
// `RoleService` ACL so this check is decoupled from the role module's
// exported shape — only `{ roles: ReadonlyArray<PlatformRoleName> }`
// reaches in here. Use as `Authz.any(SuperAdminOnly, ...)` to give
// super admins a bypass for every action.
export const SuperAdminOnly: Check<
  CurrentUser["Service"],
  unknown,
  PersistenceUnavailable,
  RoleService
> = (caller) =>
  Effect.gen(function* () {
    const roles = yield* RoleService;
    const perms = yield* roles.findPlatformPermissions(caller.userId);
    return perms.roles.includes("super_admin");
  });
