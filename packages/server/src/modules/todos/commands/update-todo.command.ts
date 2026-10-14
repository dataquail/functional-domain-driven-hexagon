import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.ts";
import { TodoId } from "@/modules/todos/domain/todo/todo.id.ts";
import { TodoRoot } from "@/modules/todos/domain/todo/todo.root.ts";

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
