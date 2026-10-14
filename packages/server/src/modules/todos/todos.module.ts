import * as Layer from "effect/Layer";

import { OrganizationModule } from "@/modules/organization/organization.module.ts";
import { RoleModule } from "@/modules/role/role.module.ts";

import { TodosRepositoryLive } from "./infrastructure/repositories/todos.repository-live.ts";
import { TodosCliLive } from "./interface/cli/todos.endpoint-groups.ts";
import { TodosLive } from "./interface/http/todos.endpoint-groups.ts";
import { TodoPoliciesLive } from "./policies/todos.policies.ts";
import { TodoCommandsLive } from "./todo.command-handlers.ts";
import { TodoQueriesLive } from "./todo.query-handlers.ts";

export const TodosModule = {
  layer: Layer.mergeAll(TodoCommandsLive, TodoQueriesLive, TodoPoliciesLive).pipe(
    Layer.provide(OrganizationModule.layer),
    Layer.provide(RoleModule.layer),
  ),

  http: Layer.mergeAll(TodosLive, TodosCliLive).pipe(Layer.provide(TodosRepositoryLive)),
};
