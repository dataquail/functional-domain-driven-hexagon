import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { RolesRepository } from "@/modules/role/domain/roles-repository.js";
import { RolesRepositoryLive } from "@/modules/role/infrastructure/roles-repository-live.js";
import { FindUserRolesQuery } from "@/modules/role/queries/find-user-roles-query.js";
import { QueryBus } from "@/platform/ddd/query-bus.js";
import { type PlatformRoleName, RoleService } from "@/platform/ddd/role-service.js";

const KNOWN_PLATFORM_ROLES = new Set<string>(["super_admin"]);

const narrow = (role: string): role is PlatformRoleName => KNOWN_PLATFORM_ROLES.has(role);

export const RoleServiceLive = Layer.effect(
  RoleService,
  Effect.gen(function* () {
    const queryBus = yield* QueryBus;
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
).pipe(Layer.provide(RolesRepositoryLive));
