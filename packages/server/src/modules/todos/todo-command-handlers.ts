import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { completeTodo } from "@/modules/todos/commands/complete-todo.js";
import {
  type CompleteTodoCommand,
  completeTodoCommandSpanAttributes,
} from "@/modules/todos/commands/complete-todo-command.js";
import { createTodo } from "@/modules/todos/commands/create-todo.js";
import {
  type CreateTodoCommand,
  createTodoCommandSpanAttributes,
} from "@/modules/todos/commands/create-todo-command.js";
import { deleteTodo } from "@/modules/todos/commands/delete-todo.js";
import {
  type DeleteTodoCommand,
  deleteTodoCommandSpanAttributes,
} from "@/modules/todos/commands/delete-todo-command.js";
import { updateTodo } from "@/modules/todos/commands/update-todo.js";
import {
  type UpdateTodoCommand,
  updateTodoCommandSpanAttributes,
} from "@/modules/todos/commands/update-todo-command.js";
import { type Todo } from "@/modules/todos/domain/todo.js";
import { type TodoNotFound } from "@/modules/todos/domain/todo-errors.js";
import { TodosRepositoryLive } from "@/modules/todos/infrastructure/todos-repository-live.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { commandHandlers } from "@/platform/ddd/ports/command-bus.js";

type CreateTodoBusOutput = Effect.Effect<Todo, PersistenceUnavailable, Database.Database>;
type DeleteTodoBusOutput = Effect.Effect<
  void,
  TodoNotFound | PersistenceUnavailable,
  Database.Database
>;
type UpdateTodoBusOutput = Effect.Effect<
  Todo,
  TodoNotFound | PersistenceUnavailable,
  Database.Database
>;
type CompleteTodoBusOutput = Effect.Effect<
  Todo,
  TodoNotFound | PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/ports/command-bus.js" {
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
