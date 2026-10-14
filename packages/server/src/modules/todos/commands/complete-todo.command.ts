import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { UserId } from "@/globals/application/ddd/ids/user-id";
import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors";
import { TodoId } from "@/modules/todos/domain/todo/todo.id";
import { TodoRoot } from "@/modules/todos/domain/todo/todo.root";

// First-class "mark done" verb (ADR-0005) — distinct from `UpdateTodoCommand`
// so the CLI can complete a todo without resupplying its title.
export const CompleteTodoCommand = Command.make("CompleteTodoCommand", {
  payload: {
    todoId: TodoId,
    organizationId: OrganizationId,
    userId: UserId,
  },
  success: TodoRoot,
  failure: Schema.Union([TodoNotFound, PersistenceUnavailable]),
});

export type CompleteTodoPayload = Command.Payload<typeof CompleteTodoCommand>;
