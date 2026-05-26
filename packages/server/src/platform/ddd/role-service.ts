import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

// The set of platform-wide role names exposed to cross-module
// consumers. Deliberately a closed literal union here — duplicated
// from the role module's value object on purpose, so that consuming
// modules (auth middleware, other modules' policies) depend only on
// this ACL and not on the role module's domain types.
export type PlatformRoleName = "super_admin";

export type PlatformPermissions = {
  readonly userId: UserId;
  readonly roles: ReadonlyArray<PlatformRoleName>;
};

// Platform-layer ACL between the `role` module and any other module's
// policies (e.g. `SuperAdminOnly` in user-policies, future
// `OrgAdminOnly` in organization-policies). The Live implementation
// dispatches the role module's `FindUserRolesQuery` through the query
// bus and maps the result into the generalized `PlatformPermissions`
// shape — keeping consumers ignorant of the role module's exported
// domain types. The same shape (port at `platform/ddd/`, Live at
// `platform/*-live.ts`) used by buses + UnitOfWork.
export type RoleServiceShape = {
  readonly findPlatformPermissions: (
    userId: UserId,
  ) => Effect.Effect<PlatformPermissions, PersistenceUnavailable>;
};

export class RoleService extends Context.Tag("RoleService")<RoleService, RoleServiceShape>() {}
