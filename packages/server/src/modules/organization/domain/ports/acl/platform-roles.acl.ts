import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type UserId } from "@/globals/application/ddd/ids/user-id.js";
import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable.js";

// ADR-0022 outbound port to the role module. Two consumers in this module: the
// policies' super-admin bypass, and the use-case invariant that a super-admin
// neither owns nor joins an organization. Both need only the boolean, so the
// role vocabulary never enters this module.
export type PlatformRolesShape = {
  readonly isSuperAdmin: (userId: UserId) => Effect.Effect<boolean, PersistenceUnavailable>;
};

export class PlatformRoles extends Context.Service<PlatformRoles, PlatformRolesShape>()(
  "@org/server/organization/PlatformRoles",
) {}
