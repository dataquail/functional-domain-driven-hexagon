import * as Layer from "effect/Layer";

import { OrganizationModule } from "@/modules/organization/organization.module";
import { RoleModule } from "@/modules/role/role.module";

import { TodosRepositoryLive } from "./infrastructure/repositories/todos.repository-live";
import { TodosCliLive } from "./interface/cli/todos.endpoint-groups";
import { TodosLive } from "./interface/http/todos.endpoint-groups";
import { TodoPoliciesLive } from "./policies/todos.policies";
import { TodoCommandsLive } from "./todo.command-handlers";
import { TodoQueriesLive } from "./todo.query-handlers";

export const TodosModule = {
  layer: Layer.mergeAll(TodoCommandsLive, TodoQueriesLive, TodoPoliciesLive).pipe(
    Layer.provide(OrganizationModule.layer),
    Layer.provide(RoleModule.layer),
  ),

  http: Layer.mergeAll(TodosLive, TodosCliLive).pipe(Layer.provide(TodosRepositoryLive)),
};
