import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Raised when a user with the same email already exists at provisioning
// time. Deliberately a platform-tier error (not the user module's
// `UserAlreadyExists`) so consumers — e.g. `auth` sign-in — depend only on
// this ACL and not on the user module's domain errors. The Live maps the
// user module's `UserAlreadyExists` into this shape.
export class UserProvisioningConflict extends Schema.TaggedErrorClass<UserProvisioningConflict>()(
  "UserProvisioningConflict",
  {
    email: Schema.String,
  },
) {}

// Platform-layer ACL letting a module provision a brand-new, ordinary
// (non-admin) application user without importing the user module's domain
// types. Used by `auth` to just-in-time provision a user on first OIDC
// sign-in. The Live implementation (in the user module) fires the user
// module's own `CreateUserCommand` through the command bus and returns the
// new `UserId`. Because it composes the command rather than opening its own
// unit of work, it joins the caller's transaction (ADR-0007 +
// `UnitOfWorkLive` re-entrancy). Same shape (port at `platform/ddd/ports/`,
// Live wired at the composition root) as `RoleService`/`MembershipService`.
export type UserProvisioningShape = {
  readonly provision: (
    email: string,
  ) => Effect.Effect<UserId, PersistenceUnavailable | UserProvisioningConflict>;
};

export class UserProvisioning extends Context.Service<UserProvisioning, UserProvisioningShape>()(
  "UserProvisioning",
) {}
