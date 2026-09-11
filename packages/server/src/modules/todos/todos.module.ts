import { Module } from "@org/module";
import * as Layer from "effect/Layer";

import { TodosRepositoryLive } from "./infrastructure/repositories/todos.repository-live.js";
import { TodosCliLive } from "./interface/cli/index.js";
import { TodosLive } from "./interface/http/index.js";
import { TodoPoliciesLive } from "./policies/todos.policies.js";
import { TodoCommandsLive } from "./todo.command-handlers.js";
import { TodoQueriesLive } from "./todo.query-handlers.js";
import { todosExports } from "./todos.exports.js";

// Both inbound adapters (GUI HTTP + CLI) dispatch to the same bus; the module
// wires both groups and the repository they share (ADR-0005).
export const TodosModule = Module.make(
  "todos",
  Layer.mergeAll(TodoCommandsLive, TodoQueriesLive, TodoPoliciesLive),
  {
    exports: todosExports,
    http: Layer.mergeAll(TodosLive, TodosCliLive).pipe(Layer.provide(TodosRepositoryLive)),
  },
);
