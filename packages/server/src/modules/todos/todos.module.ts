import * as Layer from "effect/Layer";

import { OrganizationLayer } from "@/modules/organization/organization.exports.js";
import { RoleLayer } from "@/modules/role/role.exports.js";

import { TodosRepositoryLive } from "./infrastructure/repositories/todos.repository-live.js";
import { TodosCliLive } from "./interface/cli/index.js";
import { TodosLive } from "./interface/http/index.js";
import { TodoPoliciesLive } from "./policies/todos.policies.js";
import { TodoCommandsLive } from "./todo.command-handlers.js";
import { TodoQueriesLive } from "./todo.query-handlers.js";

export const TodosLayer = Layer.mergeAll(TodoCommandsLive, TodoQueriesLive, TodoPoliciesLive).pipe(
  Layer.provide(OrganizationLayer),
  Layer.provide(RoleLayer),
);

export const TodosHttpLayer = Layer.mergeAll(TodosLive, TodosCliLive).pipe(
  Layer.provide(TodosRepositoryLive),
);
