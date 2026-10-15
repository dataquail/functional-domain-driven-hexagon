import * as Layer from "effect/Layer";

import { UserRepositoryLive } from "./infrastructure/repositories/user.repository-live";
import { UserLive } from "./interface/http/user.endpoint-groups";
import { UserCommandsLive } from "./user.command-handlers";
import { UserQueriesLive } from "./user.query-handlers";

export const UserModule = {
  layer: Layer.mergeAll(UserCommandsLive, UserQueriesLive),
  http: UserLive.pipe(Layer.provide(UserRepositoryLive)),
};
