import { Command, PersistenceUnavailable } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import { TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";
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
