import * as Layer from "effect/Layer";
import { UserRepositoryLive } from "./infrastructure/user-repository-live.js";
import { UserLive } from "./interface/http/user-live.js";

export const UserModuleLive = UserLive.pipe(Layer.provide(UserRepositoryLive));
