import * as Schema from "effect/Schema";

import { TodoId } from "./todo.id.ts";

export class TodoNotFound extends Schema.TaggedError<
  TodoNotFound,
  { readonly brand: "TodoNotFound" }
>()("TodoNotFound", {
  todoId: TodoId,
}) {}
