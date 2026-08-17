import { Command } from "@effect-server-utils/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { CompleteTodoCommand } from "@/modules/todos/commands/complete-todo.command.js";
import { completeTodoHandler } from "@/modules/todos/commands/complete-todo.handler.js";
import { CreateTodoCommand } from "@/modules/todos/commands/create-todo.command.js";
import { createTodoHandler } from "@/modules/todos/commands/create-todo.handler.js";
import { DeleteTodoCommand } from "@/modules/todos/commands/delete-todo.command.js";
import { deleteTodoHandler } from "@/modules/todos/commands/delete-todo.handler.js";
import { UpdateTodoCommand } from "@/modules/todos/commands/update-todo.command.js";
import { updateTodoHandler } from "@/modules/todos/commands/update-todo.handler.js";
import { TodosRepositoryLive } from "@/modules/todos/infrastructure/repositories/todos.repository-live.js";

export const todoCommandGroup = Command.group(
  CreateTodoCommand,
  UpdateTodoCommand,
  CompleteTodoCommand,
  DeleteTodoCommand,
);

const TodoCommandHandlersLive = Command.handlersOf(todoCommandGroup, {
  CreateTodoCommand: (payload) =>
    createTodoHandler(payload).pipe(Effect.provide(TodosRepositoryLive)),
  UpdateTodoCommand: (payload) =>
    updateTodoHandler(payload).pipe(Effect.provide(TodosRepositoryLive)),
  CompleteTodoCommand: (payload) =>
    completeTodoHandler(payload).pipe(Effect.provide(TodosRepositoryLive)),
  DeleteTodoCommand: (payload) =>
    deleteTodoHandler(payload).pipe(Effect.provide(TodosRepositoryLive)),
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
