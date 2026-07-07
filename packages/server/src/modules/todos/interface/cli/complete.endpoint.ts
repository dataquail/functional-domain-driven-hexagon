import { CliTodosContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { CompleteTodoCommand } from "@/modules/todos/commands/complete-todo.command.js";
import { TodoResource } from "@/modules/todos/policies/todos.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// CLI adapter (ADR-0024): completing is an update-gated action. The `todo`
// resolver scopes by (orgId, id), so a missing or cross-tenant todo is
// NotFound → the CLI's CliTodoNotFoundError.
export const completeEndpoint = (
  request: EndpointRequest<typeof CliTodosContract.Group, "complete">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(TodoResource, Actions.Update, {
      organizationId: request.path.orgId,
      todoId: request.path.id,
    }).pipe(
      Effect.catchTag("NotFound", () =>
        Effect.fail(
          new CliTodosContract.CliTodoNotFoundError({
            message: `Todo with id ${request.path.id} not found`,
          }),
        ),
      ),
    );
    const commandBus = yield* CommandBus;
    const currentUser = yield* CurrentUser;
    const todo = yield* commandBus.execute(
      CompleteTodoCommand.make({
        todoId: request.path.id,
        organizationId: request.path.orgId,
        userId: currentUser.userId,
      }),
    );
    return new CliTodosContract.CliTodo({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
    });
  }).pipe(
    Effect.catchTag("TodoNotFound", (err) =>
      Effect.fail(
        new CliTodosContract.CliTodoNotFoundError({
          message: `Todo with id ${err.todoId} not found`,
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("CliTodosLive.complete"),
  );
