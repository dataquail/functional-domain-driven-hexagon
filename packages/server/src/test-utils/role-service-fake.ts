import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type PlatformRoleName, RoleService } from "@/platform/ddd/ports/role-service.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Factory for an in-memory `RoleService` Layer keyed by userId. Use in
// unit tests of policies / checks that depend on platform roles, where
// you don't want to wire the role-module repo + query bus + plumbing
// to validate a boolean predicate.
export const makeRoleServiceFake = (
  rolesByUserId: ReadonlyMap<UserId, ReadonlyArray<PlatformRoleName>>,
) =>
  Layer.succeed(
    RoleService,
    RoleService.of({
      findPlatformPermissions: (userId) =>
        Effect.succeed({
          userId,
          roles: rolesByUserId.get(userId) ?? [],
        }),
    }),
  );
