import { CommandBus } from "@effect-server-utils/cqrs";
import { TodosContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { Actions } from "@/globals/application/ports/actions.ts";
import * as Authz from "@/globals/infrastructure/auth/authz.ts";
import {
  type EndpointRequest,
  recoverPersistenceUnavailable,
} from "@/globals/infrastructure/framework/http/http-endpoint.ts";
import { CreateTodoCommand } from "@/modules/todos/commands/create-todo.command.ts";
import { TodoCollectionResource } from "@/modules/todos/policies/todos.policies.ts";

export const createEndpoint = Effect.fn("TodosLive.create")(function* (
  request: EndpointRequest<typeof TodosContract.Group, "create">,
) {
  const currentUser = yield* CurrentUser;
  yield* Authz.hasPermissions(TodoCollectionResource, Actions.Create, request.params.orgId);
  const commandBus = yield* CommandBus;

  const todo = yield* commandBus.execute(CreateTodoCommand, {
    title: request.payload.title,
    organizationId: request.params.orgId,
    userId: currentUser.userId,
  });

  return new TodosContract.Todo({
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
  });
}, recoverPersistenceUnavailable);
