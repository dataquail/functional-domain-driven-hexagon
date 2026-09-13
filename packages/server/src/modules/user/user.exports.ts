import { Command, Query } from "@effect-server-utils/cqrs";

import { UserAlreadyExists } from "./domain/user/user.errors.js";
import { userCommandGroup } from "./user.command-handlers.js";
import { userQueryGroup } from "./user.query-handlers.js";

// The peer surface, one subset per consumer rather than one per module: auth
// provisions a user and organization reads members' emails, and neither should
// acquire the other's question. `DeleteUserCommand` and `FindUsersQuery` are in
// neither subset, so no peer can reach them at all.
export const userAccessCommands = Command.subsetOf(userCommandGroup, "CreateUserCommand");

export const userAccessQueries = Query.subsetOf(userQueryGroup, "FindUsersByIdsQuery");

// Part of `CreateUserCommand`'s published failure channel: a module that
// provisions through this one has to be able to name the outcome it translates,
// whether it forks on the class or catches the tag.
export const userAccessErrors = { UserAlreadyExists } as const;
