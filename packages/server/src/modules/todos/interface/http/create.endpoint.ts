import { TodosContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { CreateTodoCommand } from "@/modules/todos/commands/create-todo.command.js";
import { TodoCollectionResource } from "@/modules/todos/policies/todos.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const createEndpoint = Effect.fn("TodosLive.create")(function* (
  request: EndpointRequest<typeof TodosContract.Group, "create">,
) {
  const currentUser = yield* CurrentUser;
  yield* Authz.hasPermissions(TodoCollectionResource, Actions.Create, request.params.orgId);
  const commandBus = yield* CommandBus;
  const todo = yield* commandBus.execute(
    CreateTodoCommand.make({
      title: request.payload.title,
      organizationId: request.params.orgId,
      userId: currentUser.userId,
    }),
  );
  return new TodosContract.Todo({
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
  });
}, recoverPersistenceUnavailable);
