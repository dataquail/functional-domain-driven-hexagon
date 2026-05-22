import { UserRepositoryLive } from "./infrastructure/user-repository-live.js";

// Narrow exposure of the user infrastructure that crosses the module
// boundary. Today: `UserRepository`, needed by the platform
// `ResourceResolverRegistry` (the `user` resolver closes over it). Same
// pattern as `AuthSharedDepsLive` — keep the rest of the module-infra
// surface (mapper, fake) private to UserModuleLive, expose only what
// composition roots genuinely need to share by reference.
export const UserSharedDepsLive = UserRepositoryLive;
