import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import * as HttpApiGroup from "@effect/platform/HttpApiGroup";
import * as HttpApiSchema from "@effect/platform/HttpApiSchema";
import * as Schema from "effect/Schema";
import { TodoId } from "../EntityIds.js";
import { UserAuthMiddleware } from "../Policy.js";

export class TodoNotFoundError extends Schema.TaggedError<TodoNotFoundError>("TodoNotFoundError")(
  "TodoNotFoundError",
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({
    status: 404,
  }),
) {}

export class Todo extends Schema.Class<Todo>("Todo")({
  id: TodoId,
  title: Schema.Trim.pipe(Schema.nonEmptyString()),
  completed: Schema.Boolean,
}) {}

export class CreateTodoPayload extends Schema.Class<CreateTodoPayload>("CreateTodoPayload")({
  title: Todo.fields.title,
  optimisticId: Schema.optional(Schema.String).annotations({
    description: "Client-generated ID for optimistic updates",
  }),
}) {}

export class UpdateTodoPayload extends Schema.Class<UpdateTodoPayload>("UpdateTodoPayload")({
  id: TodoId,
  title: Todo.fields.title,
  completed: Todo.fields.completed,
}) {}

export class Group extends HttpApiGroup.make("todos")
  .middleware(UserAuthMiddleware)
  .add(HttpApiEndpoint.get("get", "/").addSuccess(Schema.Array(Todo)))
  .add(HttpApiEndpoint.post("create", "/").addSuccess(Todo).setPayload(CreateTodoPayload))
  .add(
    HttpApiEndpoint.put("update", "/:id")
      .addError(TodoNotFoundError)
      .addSuccess(Todo)
      .setPayload(UpdateTodoPayload),
  )
  .add(
    HttpApiEndpoint.del("delete", "/:id")
      .addError(TodoNotFoundError)
      .addSuccess(Schema.Void)
      .setPayload(TodoId),
  )
  .prefix("/todos") {}
