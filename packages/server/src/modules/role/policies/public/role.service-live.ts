import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { FindUserRolesQuery } from "@/modules/role/queries/find-user-roles.query.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { type PlatformRoleName, RoleService } from "@/platform/ddd/ports/role-service.js";

const KNOWN_PLATFORM_ROLES = new Set<string>(["super_admin"]);

const narrow = (role: string): role is PlatformRoleName => KNOWN_PLATFORM_ROLES.has(role);

export const RoleServiceLive = Layer.effect(
  RoleService,
  Effect.gen(function* () {
    const queryBus = yield* QueryBus;
    // After Stage B the query handler self-wraps `RolesRepository` —
    // the bus dispatch's residual R is `Database`. Capture it here and
    // provide inline at dispatch so the `RoleService` Tag's signature
    // can stay R = never (consumers don't see Database in policy R).
    const db = yield* Database.Database;

    return RoleService.of({
      findPlatformPermissions: (userId) =>
        queryBus.execute(FindUserRolesQuery.make({ userId })).pipe(
          Effect.provideService(Database.Database, db),
          Effect.map((result) => ({
            userId: result.userId,
            roles: result.roles.filter((r) => narrow(r)),
          })),
          Effect.withSpan("RoleService.findPlatformPermissions"),
        ),
    });
  }),
);
