import { RolesRepositoryLive } from "./infrastructure/roles-repository-live.js";

// Narrow exposure of role infrastructure that crosses the module
// boundary. Today: `RolesRepository`, consumed by the platform-layer
// `RoleService` (`platform/role-service-live.ts`) that wraps the query
// for cross-module policy use. Same shape as `UserSharedDepsLive`.
export const RoleSharedDepsLive = RolesRepositoryLive;
