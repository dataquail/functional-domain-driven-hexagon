import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.js";
import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const DeleteTodo = Command.make("DeleteTodoCommand", {
  payload: {
    todoId: TodoId,
    organizationId: OrganizationId,
    userId: UserId,
  },
  success: Schema.Void,
  failure: Schema.Union([TodoNotFound, PersistenceUnavailable]),
});
export type DeleteTodoPayload = Command.Payload<typeof DeleteTodo>;
