import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";

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
