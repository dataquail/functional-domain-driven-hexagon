import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable.ts";

// ADR-0022 outbound port to the role module. `/auth/me` reports whether the
// caller is a platform super admin so the client can route on it; that fact
// belongs to the role module, and this port is how auth asks for it without
// learning the role vocabulary.
export type PlatformRolesService = {
  readonly isSuperAdmin: (userId: UserId) => Effect.Effect<boolean, PersistenceUnavailable>;
};

export class PlatformRoles extends Context.Service<PlatformRoles, PlatformRolesService>()(
  "@org/server/auth/PlatformRoles",
) {}
