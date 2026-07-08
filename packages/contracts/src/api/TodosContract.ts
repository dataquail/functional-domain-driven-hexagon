import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema";
import * as Schema from "effect/Schema";

import * as CustomHttpApiError from "../CustomHttpApiError.js";
import { OrganizationId, TodoId } from "../EntityIds.js";
import { UserAuthMiddleware } from "../Policy.js";

export class TodoNotFoundError extends Schema.TaggedErrorClass<TodoNotFoundError>("TodoNotFoundError")(
  "TodoNotFoundError",
  {
    message: Schema.String,
  },
  {
      httpApiStatus: 404,
    },
) {}

export class Todo extends Schema.Class<Todo>("Todo")({
  id: TodoId,
  title: Schema.Trim.pipe(Schema.nonEmptyString()),
  completed: Schema.Boolean,
}) {}

export class CreateTodoPayload extends Schema.Class<CreateTodoPayload>("CreateTodoPayload")({
  title: Todo.fields.title,
}) {}

export class UpdateTodoPayload extends Schema.Class<UpdateTodoPayload>("UpdateTodoPayload")({
  title: Todo.fields.title,
  completed: Todo.fields.completed,
}) {}

// Phase 5: todos are org-scoped. Every endpoint carries the owning
// org in the path (`/orgs/:orgId/todos`) and is gated by org
// membership — a non-member gets 403 (`Forbidden`). The `:id` for
// update/delete moves to the path (REST-shaped, matching the org
// module's `/:orgId/members/:userId`).
export class Group extends HttpApiGroup.make("todos")
  .middleware(UserAuthMiddleware)
  .add(
    HttpApiEndpoint.get("get", "/:orgId/todos")
      .setPath(Schema.Struct({ orgId: OrganizationId }))
      .addError(CustomHttpApiError.Forbidden)
      .addSuccess(Schema.Array(Todo)),
  )
  .add(
    HttpApiEndpoint.post("create", "/:orgId/todos")
      .setPath(Schema.Struct({ orgId: OrganizationId }))
      .setPayload(CreateTodoPayload)
      .addError(CustomHttpApiError.Forbidden)
      .addSuccess(Todo),
  )
  .add(
    HttpApiEndpoint.put("update", "/:orgId/todos/:id")
      .setPath(Schema.Struct({ orgId: OrganizationId, id: TodoId }))
      .setPayload(UpdateTodoPayload)
      .addError(CustomHttpApiError.Forbidden)
      .addError(TodoNotFoundError)
      .addSuccess(Todo),
  )
  .add(
    HttpApiEndpoint.del("delete", "/:orgId/todos/:id")
      .setPath(Schema.Struct({ orgId: OrganizationId, id: TodoId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(TodoNotFoundError)
      .addSuccess(Schema.Void),
  )
  // Group-wide 503 surface — see UserContract for rationale.
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/orgs") {}
