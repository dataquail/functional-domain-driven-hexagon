import * as Layer from "effect/Layer";

import { UserRepositoryLive } from "./infrastructure/repositories/user.repository-live.ts";
import { UserLive } from "./interface/http/user.endpoint-groups.ts";
import { UserCommandsLive } from "./user.command-handlers.ts";
import { UserQueriesLive } from "./user.query-handlers.ts";

export const UserModule = {
  layer: Layer.mergeAll(UserCommandsLive, UserQueriesLive),
  http: UserLive.pipe(Layer.provide(UserRepositoryLive)),
};
