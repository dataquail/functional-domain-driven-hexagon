import { CliTodosContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { CreateTodoCommand } from "@/modules/todos/commands/create-todo-command.js";
import { todoMemberCheck } from "@/modules/todos/policies/todos-policies.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// CLI adapter (ADR-0024): same flat membership gate + CreateTodoCommand as
// the GUI's create endpoint.
export const createEndpoint = (request: EndpointRequest<typeof CliTodosContract.Group, "create">) =>
  Effect.gen(function* () {
    const currentUser = yield* CurrentUser;
    const allowed = yield* todoMemberCheck(currentUser, { organizationId: request.path.orgId });
    if (!allowed) {
      return yield* Effect.fail(
        new CustomHttpApiError.Forbidden({ message: "Not permitted: todoCollection.create" }),
      );
    }
    const commandBus = yield* CommandBus;
    const todo = yield* commandBus.execute(
      CreateTodoCommand.make({
        title: request.payload.title,
        organizationId: request.path.orgId,
        userId: currentUser.userId,
      }),
    );
    return new CliTodosContract.CliTodo({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
    });
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("CliTodosLive.create"));
