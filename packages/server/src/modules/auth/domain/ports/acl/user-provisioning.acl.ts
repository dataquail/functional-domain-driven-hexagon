import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Raised when a user with the same email already exists at provisioning time.
// This module's own error, not the user module's `UserAlreadyExists` — the
// adapter translates one into the other, which is what keeps sign-in free of
// the user module's error vocabulary.
export class UserProvisioningConflict extends Schema.TaggedErrorClass<UserProvisioningConflict>()(
  "UserProvisioningConflict",
  {
    email: Schema.String,
  },
) {}

// ADR-0022 outbound port. Auth needs to just-in-time provision a brand-new,
// ordinary (non-admin) application user on first OIDC sign-in. The port states
// that need in auth's own terms — an email in, a UserId out; the adapter in
// `infrastructure/acl/` is the only place the user module's command vocabulary
// appears. Because the adapter composes a command rather than opening its own
// unit of work, provisioning joins sign-in's transaction (ADR-0007 +
// `UnitOfWorkLive` re-entrancy).
export type UserProvisioningShape = {
  readonly provision: (
    email: string,
  ) => Effect.Effect<UserId, PersistenceUnavailable | UserProvisioningConflict>;
};

export class UserProvisioning extends Context.Service<UserProvisioning, UserProvisioningShape>()(
  "@org/server/auth/UserProvisioning",
) {}
