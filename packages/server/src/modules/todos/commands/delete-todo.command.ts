import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { UserId } from "@/globals/application/ddd/ids/user-id";
import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors";
import { TodoId } from "@/modules/todos/domain/todo/todo.id";

export const DeleteTodoCommand = Command.make("DeleteTodoCommand", {
  payload: {
    todoId: TodoId,
    organizationId: OrganizationId,
    userId: UserId,
  },
  success: Schema.Void,
  failure: Schema.Union([TodoNotFound, PersistenceUnavailable]),
});

export type DeleteTodoPayload = Command.Payload<typeof DeleteTodoCommand>;
