import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

// ADR-0022 outbound port. Billing's policies give super-admins a bypass, which
// means asking the role module a question. Stated as the single boolean billing
// cares about rather than a role list, so the platform role vocabulary stays
// inside the adapter.
export type PlatformRolesShape = {
  readonly isSuperAdmin: (userId: UserId) => Effect.Effect<boolean, PersistenceUnavailable>;
};

export class PlatformRoles extends Context.Service<PlatformRoles, PlatformRolesShape>()(
  "@org/server/billing/PlatformRoles",
) {}
