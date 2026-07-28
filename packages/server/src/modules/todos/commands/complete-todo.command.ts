import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.js";
import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

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
