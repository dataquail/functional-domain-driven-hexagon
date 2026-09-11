import { Module } from "@org/module";

import { UserCommands } from "./user.command-handlers.js";
import { UserQueries } from "./user.query-handlers.js";

// What another module may resolve from the container. Auth provisions a user
// through the write side; organization reads members' emails through the read side.
export const userExports = Module.exports(UserCommands, UserQueries);
