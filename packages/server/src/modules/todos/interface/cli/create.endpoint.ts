import { CommandBus } from "@effect-server-utils/cqrs";
import { CliTodosContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { Actions } from "@/globals/application/ports/actions.js";
import * as Authz from "@/globals/infrastructure/auth/authz.js";
import {
  type EndpointRequest,
  recoverPersistenceUnavailable,
} from "@/globals/infrastructure/framework/http/http-endpoint.js";
import { CreateTodoCommand } from "@/modules/todos/commands/create-todo.command.js";
import { TodoCollectionResource } from "@/modules/todos/policies/todos.policies.js";

// CLI adapter (ADR-0005): same membership gate + CreateTodoCommand as the
// GUI's create endpoint.
export const createEndpoint = Effect.fn("CliTodosLive.create")(function* (
  request: EndpointRequest<typeof CliTodosContract.Group, "create">,
) {
  const currentUser = yield* CurrentUser;
  yield* Authz.hasPermissions(TodoCollectionResource, Actions.Create, request.params.orgId);
  const commandBus = yield* CommandBus;
  const todo = yield* commandBus.execute(CreateTodoCommand, {
    title: request.payload.title,
    organizationId: request.params.orgId,
    userId: currentUser.userId,
  });
  return new CliTodosContract.CliTodo({
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
  });
}, recoverPersistenceUnavailable);
