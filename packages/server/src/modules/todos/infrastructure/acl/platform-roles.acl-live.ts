import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { RoleQueries } from "@/modules/role/index.js";
import { PlatformRoles } from "@/modules/todos/domain/ports/acl/platform-roles.acl.js";

const SUPER_ADMIN = "super_admin";

// ADR-0022 outbound adapter. Dispatches the role module's published policy-query and
// narrows its role-name list to the one boolean the port exposes. It resolves that
// module's own dispatch surface rather than the app-wide bus, so a module whose
// handlers need this port does not end up depending on the bus that routes those
// handlers.
export const PlatformRolesLive = Layer.effect(
  PlatformRoles,
  Effect.gen(function* () {
    const roleQueries = yield* RoleQueries;
    return PlatformRoles.of({
      isSuperAdmin: (userId) =>
        roleQueries.FindUserRolesQuery({ userId }).pipe(
          Effect.map((result) => result.roles.includes(SUPER_ADMIN)),
          Effect.withSpan("PlatformRoles.isSuperAdmin"),
        ),
    });
  }),
);
