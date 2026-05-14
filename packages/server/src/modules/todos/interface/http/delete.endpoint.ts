import { DeleteTodoCommand } from "@/modules/todos/commands/delete-todo-command.js";
import { CommandBus } from "@/platform/command-bus.js";
import { type EndpointRequest } from "@/platform/http-endpoint.js";
import { TodosContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

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
    Effect.withSpan("TodosLive.delete"),
  );
