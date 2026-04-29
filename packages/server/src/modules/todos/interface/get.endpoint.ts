import {
  type ListTodosResult,
  type ListTodosTodoView,
  ListTodosQuery,
} from "@/modules/todos/queries/list-todos-query.js";
import { type EndpointRequest } from "@/platform/http-endpoint.js";
import { QueryBus } from "@/platform/query-bus.js";
import { TodosContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

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
  }).pipe(Effect.withSpan("TodosHttpLive.get"));
