import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.ts";
import { TodoId } from "@/modules/todos/domain/todo/todo.id.ts";

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
