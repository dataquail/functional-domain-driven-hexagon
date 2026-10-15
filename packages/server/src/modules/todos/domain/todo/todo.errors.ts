import * as Schema from "effect/Schema";

import { TodoId } from "./todo.id";

export class TodoNotFound extends Schema.TaggedError<
  TodoNotFound,
  { readonly brand: "TodoNotFound" }
>()("TodoNotFound", {
  todoId: TodoId,
}) {}
