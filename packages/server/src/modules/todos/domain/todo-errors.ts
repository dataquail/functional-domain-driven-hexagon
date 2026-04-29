import * as Schema from "effect/Schema";
import { TodoId } from "./todo-id.js";

export class TodoNotFound extends Schema.TaggedError<TodoNotFound>("TodoNotFound")("TodoNotFound", {
  todoId: TodoId,
}) {}
