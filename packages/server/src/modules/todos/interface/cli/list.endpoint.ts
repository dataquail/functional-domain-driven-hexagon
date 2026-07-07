import { CliTodosContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { TodoCollectionResource } from "@/modules/todos/policies/todos.policies.js";
import {
  ListTodosQuery,
  type ListTodosTodoView,
} from "@/modules/todos/queries/list-todos.query.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

const toCli = (view: ListTodosTodoView): CliTodosContract.CliTodo =>
  new CliTodosContract.CliTodo({ id: view.id, title: view.title, completed: view.completed });

// CLI adapter (ADR-0024): same membership gate + ListTodosQuery as the GUI's
// get endpoint, mapped to the CLI's own `CliTodo` shape.
export const listEndpoint = (request: EndpointRequest<typeof CliTodosContract.Group, "list">) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(TodoCollectionResource, Actions.Read, request.path.orgId).pipe(
      Effect.catchTag("NotFound", () =>
        Effect.die("Unreachable: todoCollection resolver cannot surface NotFound"),
      ),
    );
    const queryBus = yield* QueryBus;
    const result = yield* queryBus.execute(
      ListTodosQuery.make({ organizationId: request.path.orgId }),
    );
    return result.todos.map(toCli);
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("CliTodosLive.list"));
