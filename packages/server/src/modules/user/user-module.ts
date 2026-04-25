import * as Layer from "effect/Layer";
import { UserRepositoryLive } from "./infrastructure/user-repository-live.js";
import { UserHttpLive } from "./interface/user-http-live.js";

export const UserModuleLive = UserHttpLive.pipe(Layer.provide(UserRepositoryLive));
