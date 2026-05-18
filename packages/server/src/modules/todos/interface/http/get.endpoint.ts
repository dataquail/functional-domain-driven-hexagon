import { TodosContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import {
  ListTodosQuery,
  type ListTodosResult,
  type ListTodosTodoView,
} from "@/modules/todos/queries/list-todos-query.js";
import { QueryBus } from "@/platform/ddd/query-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

const toContract = (view: ListTodosTodoView): TodosContract.Todo =>
  new TodosContract.Todo({
    id: view.id,
    title: view.title,
    completed: view.completed,
  });

const toResponse = (result: ListTodosResult): ReadonlyArray<TodosContract.Todo> =>
  result.todos.map(toContract);

export const getEndpoint = (_request: EndpointRequest<typeof TodosContract.Group, "get">) =>
  Effect.gen(function* () {
    const queryBus = yield* QueryBus;
    const result = yield* queryBus.execute(ListTodosQuery.make({}));
    return toResponse(result);
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("TodosLive.get"));
