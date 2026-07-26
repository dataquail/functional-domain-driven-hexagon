import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { FindUserRolesQuery } from "@/modules/role/index.js";
import { PlatformRoles } from "@/modules/todos/domain/ports/acl/platform-roles.acl.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";

const SUPER_ADMIN = "super_admin";

// ADR-0022 outbound adapter. Dispatches the role module's published
// policy-query and narrows its role-name list to the one boolean the port
// exposes. `Database` is captured at construction and re-provided to the
// dispatched effect so the port's method surface stays `R = never`.
export const PlatformRolesLive = Layer.effect(
  PlatformRoles,
  Effect.gen(function* () {
    const queryBus = yield* QueryBus;
    const db = yield* Database.Database;

    return PlatformRoles.of({
      isSuperAdmin: (userId) =>
        queryBus.execute(FindUserRolesQuery.make({ userId })).pipe(
          Effect.provideService(Database.Database, db),
          Effect.map((result) => result.roles.includes(SUPER_ADMIN)),
          Effect.withSpan("PlatformRoles.isSuperAdmin"),
        ),
    });
  }),
);
