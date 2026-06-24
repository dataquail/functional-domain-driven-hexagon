import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import * as HttpApiGroup from "@effect/platform/HttpApiGroup";
import * as HttpApiSchema from "@effect/platform/HttpApiSchema";
import * as Schema from "effect/Schema";

import * as CustomHttpApiError from "../CustomHttpApiError.js";
import { OrganizationId, TodoId } from "../EntityIds.js";
import { UserAuthMiddleware } from "../Policy.js";

// CLI-specific error, distinct from the GUI's `TodosContract.TodoNotFoundError`
// so the two contracts evolve independently (ADR-0024).
export class CliTodoNotFoundError extends Schema.TaggedError<CliTodoNotFoundError>(
  "CliTodoNotFoundError",
)("CliTodoNotFoundError", { message: Schema.String }, HttpApiSchema.annotations({ status: 404 })) {}

export class CliTodo extends Schema.Class<CliTodo>("CliTodo")({
  id: TodoId,
  title: Schema.String,
  completed: Schema.Boolean,
}) {}

export class CliCreateTodoPayload extends Schema.Class<CliCreateTodoPayload>(
  "CliCreateTodoPayload",
)({
  title: Schema.Trim.pipe(Schema.nonEmptyString()),
}) {}

// CLI-facing todos surface. Same org-scoped paths as the GUI, but its own
// shapes and a first-class `complete` verb (the GUI only has `update`).
export class Group extends HttpApiGroup.make("cliTodos")
  .middleware(UserAuthMiddleware)
  .add(
    HttpApiEndpoint.get("list", "/:orgId/todos")
      .setPath(Schema.Struct({ orgId: OrganizationId }))
      .addError(CustomHttpApiError.Forbidden)
      .addSuccess(Schema.Array(CliTodo)),
  )
  .add(
    HttpApiEndpoint.post("create", "/:orgId/todos")
      .setPath(Schema.Struct({ orgId: OrganizationId }))
      .setPayload(CliCreateTodoPayload)
      .addError(CustomHttpApiError.Forbidden)
      .addSuccess(CliTodo),
  )
  .add(
    HttpApiEndpoint.post("complete", "/:orgId/todos/:id/complete")
      .setPath(Schema.Struct({ orgId: OrganizationId, id: TodoId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(CliTodoNotFoundError)
      .addSuccess(CliTodo),
  )
  .add(
    HttpApiEndpoint.del("remove", "/:orgId/todos/:id")
      .setPath(Schema.Struct({ orgId: OrganizationId, id: TodoId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(CliTodoNotFoundError)
      .addSuccess(Schema.Void),
  )
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/cli/orgs") {}
