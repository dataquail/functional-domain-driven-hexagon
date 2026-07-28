import { Command } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { CompleteTodo } from "@/modules/todos/commands/complete-todo.command.js";
import { completeTodo } from "@/modules/todos/commands/complete-todo.handler.js";
import { CreateTodo } from "@/modules/todos/commands/create-todo.command.js";
import { createTodo } from "@/modules/todos/commands/create-todo.handler.js";
import { DeleteTodo } from "@/modules/todos/commands/delete-todo.command.js";
import { deleteTodo } from "@/modules/todos/commands/delete-todo.handler.js";
import { UpdateTodo } from "@/modules/todos/commands/update-todo.command.js";
import { updateTodo } from "@/modules/todos/commands/update-todo.handler.js";
import { TodosRepositoryLive } from "@/modules/todos/infrastructure/repositories/todos.repository-live.js";

const todoCommandGroup = Command.group(CreateTodo, UpdateTodo, CompleteTodo, DeleteTodo);

const TodoCommandHandlersLive = Command.handlersOf(todoCommandGroup, {
  CreateTodoCommand: (payload) => createTodo(payload).pipe(Effect.provide(TodosRepositoryLive)),
  UpdateTodoCommand: (payload) => updateTodo(payload).pipe(Effect.provide(TodosRepositoryLive)),
  CompleteTodoCommand: (payload) => completeTodo(payload).pipe(Effect.provide(TodosRepositoryLive)),
  DeleteTodoCommand: (payload) => deleteTodo(payload).pipe(Effect.provide(TodosRepositoryLive)),
});

// A todo's title is user-supplied content, so it never reaches a span; the generated id
// is annotated from inside the create handler instead.
const todoCommandSpanAttributes: Command.SpanAttributes<typeof todoCommandGroup> = {
  CreateTodoCommand: (payload) => ({
    "user.id": payload.userId,
    "organization.id": payload.organizationId,
  }),
  UpdateTodoCommand: (payload) => ({
    "todo.id": payload.todoId,
    "organization.id": payload.organizationId,
    "todo.completed": payload.completed,
    "user.id": payload.userId,
  }),
  CompleteTodoCommand: (payload) => ({
    "todo.id": payload.todoId,
    "organization.id": payload.organizationId,
    "user.id": payload.userId,
  }),
  DeleteTodoCommand: (payload) => ({
    "todo.id": payload.todoId,
    "organization.id": payload.organizationId,
    "user.id": payload.userId,
  }),
};

// This module's slice of the write-side dispatch surface. See `WalletCommands` for why a
// module publishes its own surface rather than letting consumers name the bus.
export class TodoCommands extends Context.Service<
  TodoCommands,
  Command.Dispatcher<typeof todoCommandGroup>
>()("@org/server/todos/TodoCommands") {}

export const TodoCommandsLive = Layer.effect(
  TodoCommands,
  Command.dispatcher(todoCommandGroup, { spanAttributes: todoCommandSpanAttributes }),
).pipe(Layer.provide(TodoCommandHandlersLive));
