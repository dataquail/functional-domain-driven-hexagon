import * as Layer from "effect/Layer";

import { OrganizationModule } from "@/modules/organization/organization.module.js";
import { RoleModule } from "@/modules/role/role.module.js";

import { TodosRepositoryLive } from "./infrastructure/repositories/todos.repository-live.js";
import { TodosCliLive } from "./interface/cli/index.js";
import { TodosLive } from "./interface/http/index.js";
import { TodoPoliciesLive } from "./policies/todos.policies.js";
import { TodoCommandsLive } from "./todo.command-handlers.js";
import { TodoQueriesLive } from "./todo.query-handlers.js";

export const TodosModule = {
  layer: Layer.mergeAll(TodoCommandsLive, TodoQueriesLive, TodoPoliciesLive).pipe(
    Layer.provide(OrganizationModule.layer),
    Layer.provide(RoleModule.layer),
  ),

  http: Layer.mergeAll(TodosLive, TodosCliLive).pipe(Layer.provide(TodosRepositoryLive)),
};
