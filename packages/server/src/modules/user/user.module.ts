import * as Layer from "effect/Layer";

import { UserRepositoryLive } from "./infrastructure/repositories/user.repository-live.js";
import { UserLive } from "./interface/http/index.js";
import { UserCommandsLive } from "./user.command-handlers.js";
import { UserQueriesLive } from "./user.query-handlers.js";

export const UserLayer = Layer.mergeAll(UserCommandsLive, UserQueriesLive);

export const UserHttpLayer = UserLive.pipe(Layer.provide(UserRepositoryLive));
