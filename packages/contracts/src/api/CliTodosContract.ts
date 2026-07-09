import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import * as CustomHttpApiError from "../CustomHttpApiError.js";
import { OrganizationId, TodoId } from "../EntityIds.js";
import { UserAuthMiddleware } from "../Policy.js";

// CLI-specific error, distinct from the GUI's `TodosContract.TodoNotFoundError`
// so the two contracts evolve independently (ADR-0005).
export class CliTodoNotFoundError extends Schema.TaggedErrorClass<CliTodoNotFoundError>(
  "CliTodoNotFoundError",
)("CliTodoNotFoundError", { message: Schema.String }, { httpApiStatus: 404 }) {}

export class CliTodo extends Schema.Class<CliTodo>("CliTodo")({
  id: TodoId,
  title: Schema.String,
  completed: Schema.Boolean,
}) {}

export class CliCreateTodoPayload extends Schema.Class<CliCreateTodoPayload>(
  "CliCreateTodoPayload",
)({
  title: Schema.Trim.check(Schema.isNonEmpty()),
}) {}

// CLI-facing todos surface. Same org-scoped paths as the GUI, but its own
// shapes and a first-class `complete` verb (the GUI only has `update`).
export class Group extends HttpApiGroup.make("cliTodos")
  .add(
    HttpApiEndpoint.get("list", "/:orgId/todos", {
      params: Schema.Struct({ orgId: OrganizationId }),
      success: Schema.Array(CliTodo),
      error: [CustomHttpApiError.Forbidden, CustomHttpApiError.ServiceUnavailable],
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/:orgId/todos", {
      params: Schema.Struct({ orgId: OrganizationId }),
      payload: CliCreateTodoPayload,
      success: CliTodo,
      error: [CustomHttpApiError.Forbidden, CustomHttpApiError.ServiceUnavailable],
    }),
  )
  .add(
    HttpApiEndpoint.post("complete", "/:orgId/todos/:id/complete", {
      params: Schema.Struct({ orgId: OrganizationId, id: TodoId }),
      success: CliTodo,
      error: [
        CustomHttpApiError.Forbidden,
        CliTodoNotFoundError,
        CustomHttpApiError.ServiceUnavailable,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/:orgId/todos/:id", {
      params: Schema.Struct({ orgId: OrganizationId, id: TodoId }),
      success: Schema.Void,
      error: [
        CustomHttpApiError.Forbidden,
        CliTodoNotFoundError,
        CustomHttpApiError.ServiceUnavailable,
      ],
    }),
  )
  .middleware(UserAuthMiddleware)
  .prefix("/cli/orgs") {}
