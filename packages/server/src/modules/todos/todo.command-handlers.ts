import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import {
  type CompleteTodoCommand,
  completeTodoCommandSpanAttributes,
} from "@/modules/todos/commands/complete-todo.command.js";
import { completeTodo } from "@/modules/todos/commands/complete-todo.handler.js";
import {
  type CreateTodoCommand,
  createTodoCommandSpanAttributes,
} from "@/modules/todos/commands/create-todo.command.js";
import { createTodo } from "@/modules/todos/commands/create-todo.handler.js";
import {
  type DeleteTodoCommand,
  deleteTodoCommandSpanAttributes,
} from "@/modules/todos/commands/delete-todo.command.js";
import { deleteTodo } from "@/modules/todos/commands/delete-todo.handler.js";
import {
  type UpdateTodoCommand,
  updateTodoCommandSpanAttributes,
} from "@/modules/todos/commands/update-todo.command.js";
import { updateTodo } from "@/modules/todos/commands/update-todo.handler.js";
import { type TodoNotFound } from "@/modules/todos/domain/todo.errors.js";
import { type TodoRoot } from "@/modules/todos/domain/todo.root.js";
import { TodosRepositoryLive } from "@/modules/todos/infrastructure/repositories/todos.repository-live.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { commandHandlers } from "@/platform/ddd/ports/command-bus.js";

type CreateTodoBusOutput = Effect.Effect<TodoRoot, PersistenceUnavailable, Database.Database>;
type DeleteTodoBusOutput = Effect.Effect<
  void,
  TodoNotFound | PersistenceUnavailable,
  Database.Database
>;
type UpdateTodoBusOutput = Effect.Effect<
  TodoRoot,
  TodoNotFound | PersistenceUnavailable,
  Database.Database
>;
type CompleteTodoBusOutput = Effect.Effect<
  TodoRoot,
  TodoNotFound | PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/ports/command-bus.js" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires `interface`
  interface CommandRegistry {
    CreateTodoCommand: {
      readonly command: CreateTodoCommand;
      readonly output: CreateTodoBusOutput;
    };
    UpdateTodoCommand: {
      readonly command: UpdateTodoCommand;
      readonly output: UpdateTodoBusOutput;
    };
    CompleteTodoCommand: {
      readonly command: CompleteTodoCommand;
      readonly output: CompleteTodoBusOutput;
    };
    DeleteTodoCommand: {
      readonly command: DeleteTodoCommand;
      readonly output: DeleteTodoBusOutput;
    };
  }
}

export const todoCommandHandlers = commandHandlers({
  CreateTodoCommand: {
    handle: (cmd): CreateTodoBusOutput => createTodo(cmd).pipe(Effect.provide(TodosRepositoryLive)),
    spanAttributes: createTodoCommandSpanAttributes,
  },
  UpdateTodoCommand: {
    handle: (cmd): UpdateTodoBusOutput => updateTodo(cmd).pipe(Effect.provide(TodosRepositoryLive)),
    spanAttributes: updateTodoCommandSpanAttributes,
  },
  CompleteTodoCommand: {
    handle: (cmd): CompleteTodoBusOutput =>
      completeTodo(cmd).pipe(Effect.provide(TodosRepositoryLive)),
    spanAttributes: completeTodoCommandSpanAttributes,
  },
  DeleteTodoCommand: {
    handle: (cmd): DeleteTodoBusOutput => deleteTodo(cmd).pipe(Effect.provide(TodosRepositoryLive)),
    spanAttributes: deleteTodoCommandSpanAttributes,
  },
});
