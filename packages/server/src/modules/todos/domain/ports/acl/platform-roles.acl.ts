import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

// ADR-0022 outbound port. Todos' policies give super-admins a bypass, which
// means asking the role module a question. The port states it as the single
// boolean todos cares about rather than exposing a role list: the platform role
// vocabulary stays entirely inside the adapter, so the role module can add,
// rename, or restructure roles without touching this module.
export type PlatformRolesShape = {
  readonly isSuperAdmin: (userId: UserId) => Effect.Effect<boolean, PersistenceUnavailable>;
};

export class PlatformRoles extends Context.Service<PlatformRoles, PlatformRolesShape>()(
  "@org/server/todos/PlatformRoles",
) {}
