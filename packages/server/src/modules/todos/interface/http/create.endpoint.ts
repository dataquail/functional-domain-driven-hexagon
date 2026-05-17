import { TodosContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { CreateTodoCommand } from "@/modules/todos/commands/create-todo-command.js";
import { CommandBus } from "@/platform/ddd/command-bus.js";
import { type EndpointRequest } from "@/platform/http-endpoint.js";

export const createEndpoint = (request: EndpointRequest<typeof TodosContract.Group, "create">) =>
  Effect.gen(function* () {
    const commandBus = yield* CommandBus;
    const currentUser = yield* CurrentUser;
    const todo = yield* commandBus.execute(
      CreateTodoCommand.make({
        title: request.payload.title,
        userId: currentUser.userId,
      }),
    );
    return new TodosContract.Todo({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
    });
  }).pipe(Effect.withSpan("TodosLive.create"));
