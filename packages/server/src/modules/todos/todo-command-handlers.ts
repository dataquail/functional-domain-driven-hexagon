import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

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
import { commandHandlers } from "@/platform/ddd/command-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";

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

declare module "@/platform/ddd/command-bus.js" {
  interface CommandRegistry {
    CreateTodoCommand: {
      readonly command: CreateTodoCommand;
      readonly output: CreateTodoBusOutput;
    };
    UpdateTodoCommand: {
      readonly command: UpdateTodoCommand;
      readonly output: UpdateTodoBusOutput;
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
  DeleteTodoCommand: {
    handle: (cmd): DeleteTodoBusOutput => deleteTodo(cmd).pipe(Effect.provide(TodosRepositoryLive)),
    spanAttributes: deleteTodoCommandSpanAttributes,
  },
});
