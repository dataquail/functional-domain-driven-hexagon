import { QueryBus } from "@effect-server-utils/cqrs";
import { TodosContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { Actions } from "@/globals/application/ports/actions.js";
import * as Authz from "@/globals/infrastructure/auth/authz.js";
import {
  type EndpointRequest,
  recoverPersistenceUnavailable,
} from "@/globals/infrastructure/framework/http/http-endpoint.js";
import { TodoCollectionResource } from "@/modules/todos/policies/todos.policies.js";
import {
  ListTodosQuery,
  type ListTodosResult,
  type ListTodosTodoView,
} from "@/modules/todos/queries/list-todos.query.js";

const toContract = (view: ListTodosTodoView): TodosContract.Todo =>
  new TodosContract.Todo({
    id: view.id,
    title: view.title,
    completed: view.completed,
  });

const toResponse = (result: ListTodosResult): ReadonlyArray<TodosContract.Todo> =>
  result.todos.map(toContract);

export const getEndpoint = Effect.fn("TodosLive.get")(function* (
  request: EndpointRequest<typeof TodosContract.Group, "get">,
) {
  yield* Authz.hasPermissions(TodoCollectionResource, Actions.Read, request.params.orgId);
  const queryBus = yield* QueryBus;
  const result = yield* queryBus.execute(ListTodosQuery, { organizationId: request.params.orgId });
  return toResponse(result);
}, recoverPersistenceUnavailable);
