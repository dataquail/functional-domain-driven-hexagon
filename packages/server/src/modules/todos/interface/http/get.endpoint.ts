import { TodosContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { TodoCollectionResource } from "@/modules/todos/policies/todos.policies.js";
import {
  ListTodosQuery,
  type ListTodosResult,
  type ListTodosTodoView,
} from "@/modules/todos/queries/list-todos.query.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

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
  // The `todoCollection` resolver is a deliberate echo of the orgId
  // and never fails NotFound (the collection's identity *is* the org;
  // we don't leak org existence to non-members). `hasPermissions`
  // declares NotFound for resource-scoped calls, so collapse the
  // unreachable case to a defect.
  yield* Authz.hasPermissions(TodoCollectionResource, Actions.Read, request.params.orgId).pipe(
    Effect.catchTag("NotFound", () =>
      Effect.die("Unreachable: todoCollection resolver cannot surface NotFound"),
    ),
  );
  const queryBus = yield* QueryBus;
  const result = yield* queryBus.execute(
    ListTodosQuery.make({ organizationId: request.params.orgId }),
  );
  return toResponse(result);
}, recoverPersistenceUnavailable);
