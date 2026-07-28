import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.js";
import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const UpdateTodoCommand = Command.make("UpdateTodoCommand", {
  payload: {
    todoId: TodoId,
    organizationId: OrganizationId,
    title: Schema.String,
    completed: Schema.Boolean,
    userId: UserId,
  },
  success: TodoRoot,
  failure: Schema.Union([TodoNotFound, PersistenceUnavailable]),
});
export type UpdateTodoPayload = Command.Payload<typeof UpdateTodoCommand>;
