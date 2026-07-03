import * as Layer from "effect/Layer";

import { UserRepositoryLive } from "./infrastructure/repositories/user.repository-live.js";
import { UserLive } from "./interface/http/index.js";

export const UserModuleLive = UserLive.pipe(Layer.provide(UserRepositoryLive));
