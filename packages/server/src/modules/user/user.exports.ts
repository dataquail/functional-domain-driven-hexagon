import { Command, Query } from "@effect-server-utils/cqrs";

import { userCommandGroup } from "./user.command-handlers.js";
import { userQueryGroup } from "./user.query-handlers.js";

// The peer surface, one subset per consumer rather than one per module: auth
// provisions a user and organization reads members' emails, and neither should
// acquire the other's question. `DeleteUserCommand` and `FindUsersQuery` are in
// neither subset, so no peer can reach them at all.
export const userProvisioningCommands = Command.subsetOf(userCommandGroup, "CreateUserCommand");

export const userLookupQueries = Query.subsetOf(userQueryGroup, "FindUsersByIdsQuery");

// Part of `CreateUserCommand`'s published failure channel: a module that
// provisions through this one has to be able to name the outcome it translates.
export { UserAlreadyExists } from "./domain/user/user.errors.js";

// The layer a peer provides in order to import this module.
export { UserLayer } from "./user.module.js";
