import { Module } from "@org/module";

import { UserCommands } from "./user.command-handlers.js";
import { UserQueries } from "./user.query-handlers.js";

// The peer-facing surface. Auth provisions a user through the write side;
// organization reads members' emails through the read side. Both resolve these
// from the container through their own ACL ports, which is why they are in the
// DI half as well as re-exported below.
export const userExports = Module.exports(UserCommands, UserQueries);

export { UserCommands } from "./user.command-handlers.js";
export { UserQueries } from "./user.query-handlers.js";
// Part of `CreateUserCommand`'s published failure channel: a module that
// provisions through this one has to be able to name the outcome it translates.
export { UserAlreadyExists } from "./domain/user/user.errors.js";
