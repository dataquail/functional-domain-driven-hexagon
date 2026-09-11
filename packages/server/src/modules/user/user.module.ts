import { Module } from "@org/module";
import * as Layer from "effect/Layer";

import { UserRepositoryLive } from "./infrastructure/repositories/user.repository-live.js";
import { UserLive } from "./interface/http/index.js";
import { UserCommandsLive } from "./user.command-handlers.js";
import { userExports } from "./user.exports.js";
import { UserQueriesLive } from "./user.query-handlers.js";

// Both surfaces are published: auth provisions a user through UserCommands, and
// organization reads members' emails through UserQueries.
export const UserModule = Module.make("user", Layer.mergeAll(UserCommandsLive, UserQueriesLive), {
  exports: userExports,
  http: UserLive.pipe(Layer.provide(UserRepositoryLive)),
});
