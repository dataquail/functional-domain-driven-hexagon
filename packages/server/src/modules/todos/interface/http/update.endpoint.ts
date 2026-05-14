import { UpdateTodoCommand } from "@/modules/todos/commands/update-todo-command.js";
import { CommandBus } from "@/platform/command-bus.js";
import { type EndpointRequest } from "@/platform/http-endpoint.js";
import { TodosContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

export const updateEndpoint = (request: EndpointRequest<typeof TodosContract.Group, "update">) =>
  Effect.gen(function* () {
    const commandBus = yield* CommandBus;
    const currentUser = yield* CurrentUser;
    const todo = yield* commandBus.execute(
      UpdateTodoCommand.make({
        todoId: request.payload.id,
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
  }).pipe(
    Effect.catchTag("TodoNotFound", (err) =>
      Effect.fail(
        new TodosContract.TodoNotFoundError({
          message: `Todo with id ${err.todoId} not found`,
        }),
      ),
    ),
    Effect.withSpan("TodosLive.update"),
  );
