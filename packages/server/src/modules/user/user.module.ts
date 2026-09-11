import { type Command, type Query } from "@effect-server-utils/cqrs";
import { Module } from "@org/module";
import * as Layer from "effect/Layer";

import { UserRepositoryLive } from "./infrastructure/repositories/user.repository-live.js";
import { UserLive } from "./interface/http/index.js";
import { UserCommandsLive } from "./user.command-handlers.js";
import { type userLookupQueries, type userProvisioningCommands } from "./user.exports.js";
import { UserQueriesLive } from "./user.query-handlers.js";

// Two subsets, one per consumer: auth provisions a user, organization reads
// members' emails, and neither acquires the other's question. `DeleteUserCommand`
// and `FindUsersQuery` are in neither, so no peer can reach them.
export const UserModule = Module.make<
  Command.Registered<typeof userProvisioningCommands> | Query.Registered<typeof userLookupQueries>
>()("user", Layer.mergeAll(UserCommandsLive, UserQueriesLive), {
  http: UserLive.pipe(Layer.provide(UserRepositoryLive)),
});
