import { CliTodosContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { DeleteTodoCommand } from "@/modules/todos/commands/delete-todo-command.js";
import { TodoResource } from "@/modules/todos/policies/todos-policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// CLI adapter (ADR-0024): same delete-gated resource + DeleteTodoCommand as
// the GUI's delete endpoint, with the CLI's own NotFound shape.
export const removeEndpoint = (request: EndpointRequest<typeof CliTodosContract.Group, "remove">) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(TodoResource, Actions.Delete, {
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
    yield* commandBus.execute(
      DeleteTodoCommand.make({
        todoId: request.path.id,
        organizationId: request.path.orgId,
        userId: currentUser.userId,
      }),
    );
  }).pipe(
    Effect.catchTag("TodoNotFound", (err) =>
      Effect.fail(
        new CliTodosContract.CliTodoNotFoundError({
          message: `Todo with id ${err.todoId} not found`,
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("CliTodosLive.remove"),
  );
