import { CliTodosContract } from "@org/contracts/api/Contracts";
import { QueryBus } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { TodoCollectionResource } from "@/modules/todos/policies/todos.policies.js";
import {
  ListTodosQuery,
  type ListTodosTodoView,
} from "@/modules/todos/queries/list-todos.query.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

const toCli = (view: ListTodosTodoView): CliTodosContract.CliTodo =>
  new CliTodosContract.CliTodo({ id: view.id, title: view.title, completed: view.completed });

// CLI adapter (ADR-0005): same membership gate + ListTodosQuery as the GUI's
// get endpoint, mapped to the CLI's own `CliTodo` shape.
export const listEndpoint = Effect.fn("CliTodosLive.list")(function* (
  request: EndpointRequest<typeof CliTodosContract.Group, "list">,
) {
  yield* Authz.hasPermissions(TodoCollectionResource, Actions.Read, request.params.orgId);
  const queryBus = yield* QueryBus;
  const result = yield* queryBus.execute(ListTodosQuery, { organizationId: request.params.orgId });
  return result.todos.map(toCli);
}, recoverPersistenceUnavailable);
