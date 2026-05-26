import * as Layer from "effect/Layer";

import { RoleManagementLive } from "./infrastructure/external/role-management-live.js";
import { UserRepositoryLive } from "./infrastructure/user-repository-live.js";
import { UserLive } from "./interface/http/user-live.js";

// `RoleManagementLive` (ADR-0023 outbound adapter) depends on the command
// bus + DDD shared-kernel services, which the composition root provides to
// this module from the outside — the same way it satisfies the buses every
// HTTP group already dispatches through.
export const UserModuleLive = UserLive.pipe(
  Layer.provide(UserRepositoryLive),
  Layer.provide(RoleManagementLive),
);
