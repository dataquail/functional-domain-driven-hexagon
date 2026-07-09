import { TodosContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { UpdateTodoCommand } from "@/modules/todos/commands/update-todo.command.js";
import { TodoResource } from "@/modules/todos/policies/todos.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const updateEndpoint = Effect.fn("TodosLive.update")(
  function* (request: EndpointRequest<typeof TodosContract.Group, "update">) {
    // The `todo` resolver loads the row scoped to (orgId, id); a missing
    // or cross-tenant todo surfaces as NotFound, mapped to the contract's
    // TodoNotFoundError. Membership against the todo's real org is then
    // checked before the command runs.
    yield* Authz.hasPermissions(TodoResource, Actions.Update, {
      organizationId: request.params.orgId,
      todoId: request.params.id,
    }).pipe(
      Effect.catchTag("NotFound", () =>
        Effect.fail(
          new TodosContract.TodoNotFoundError({
            message: `Todo with id ${request.params.id} not found`,
          }),
        ),
      ),
    );
    const commandBus = yield* CommandBus;
    const currentUser = yield* CurrentUser;
    const todo = yield* commandBus.execute(
      UpdateTodoCommand.make({
        todoId: request.params.id,
        organizationId: request.params.orgId,
        title: request.payload.title,
        completed: request.payload.completed,
        userId: currentUser.userId,
      }),
    );
    return new TodosContract.Todo({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
    });
  },
  Effect.catchTag("TodoNotFound", (err) =>
    Effect.fail(
      new TodosContract.TodoNotFoundError({
        message: `Todo with id ${err.todoId} not found`,
      }),
    ),
  ),
  recoverPersistenceUnavailable,
);
