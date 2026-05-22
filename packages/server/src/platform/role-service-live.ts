import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { FindUserRolesQuery, RolesRepository } from "@/modules/role/index.js";
import { QueryBus } from "@/platform/ddd/query-bus.js";
import { type PlatformRoleName, RoleService } from "@/platform/ddd/role-service.js";

// Allowlist of role names exposed to platform-layer consumers. Drops
// anything the consumer surface doesn't know about — defense in depth
// if the role module ever stores values that haven't propagated here.
const KNOWN_PLATFORM_ROLES = new Set<string>(["super_admin"]);

const narrow = (role: string): role is PlatformRoleName => KNOWN_PLATFORM_ROLES.has(role);

export const RoleServiceLive = Layer.effect(
  RoleService,
  Effect.gen(function* () {
    const queryBus = yield* QueryBus;
    // FindUserRolesQuery's handler reads from `RolesRepository` — capture
    // it at layer construction and provide it inline at dispatch. Same
    // shape as `UserAuthMiddlewareLive` provides `SessionRepository`
    // around its `FindSessionQuery` dispatch.
    const repo = yield* RolesRepository;

    return RoleService.of({
      findPlatformPermissions: (userId) =>
        queryBus.execute(FindUserRolesQuery.make({ userId })).pipe(
          Effect.provideService(RolesRepository, repo),
          Effect.map((result) => ({
            userId: result.userId,
            roles: result.roles.filter((r) => narrow(r)),
          })),
          Effect.withSpan("RoleService.findPlatformPermissions"),
        ),
    });
  }),
);
