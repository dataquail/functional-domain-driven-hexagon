import { TodosContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { DeleteTodoCommand } from "@/modules/todos/commands/delete-todo-command.js";
import { CommandBus } from "@/platform/ddd/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const deleteEndpoint = (request: EndpointRequest<typeof TodosContract.Group, "delete">) =>
  Effect.gen(function* () {
    const commandBus = yield* CommandBus;
    const currentUser = yield* CurrentUser;
    yield* commandBus.execute(
      DeleteTodoCommand.make({
        todoId: request.payload,
        userId: currentUser.userId,
      }),
    );
  }).pipe(
    Effect.catchTag("TodoNotFound", (err) =>
      Effect.fail(
        new TodosContract.TodoNotFoundError({
          message: `Todo with id ${err.todoId} not found`,
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("TodosLive.delete"),
  );
