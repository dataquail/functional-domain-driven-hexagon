import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const CreateTodoCommand = Command.make("CreateTodoCommand", {
  payload: {
    title: Schema.String,
    organizationId: OrganizationId,
    userId: UserId,
  },
  success: TodoRoot,
  failure: PersistenceUnavailable,
});
export type CreateTodoPayload = Command.Payload<typeof CreateTodoCommand>;
