import { createTodoCommandSpanAttributes } from "@/modules/todos/commands/create-todo-command.js";
import { createTodo } from "@/modules/todos/commands/create-todo.js";
import { deleteTodoCommandSpanAttributes } from "@/modules/todos/commands/delete-todo-command.js";
import { deleteTodo } from "@/modules/todos/commands/delete-todo.js";
import { updateTodoCommandSpanAttributes } from "@/modules/todos/commands/update-todo-command.js";
import { updateTodo } from "@/modules/todos/commands/update-todo.js";
import { commandHandlers } from "@/platform/command-bus.js";

export const todoCommandHandlers = commandHandlers({
  CreateTodoCommand: { handle: createTodo, spanAttributes: createTodoCommandSpanAttributes },
  UpdateTodoCommand: { handle: updateTodo, spanAttributes: updateTodoCommandSpanAttributes },
  DeleteTodoCommand: { handle: deleteTodo, spanAttributes: deleteTodoCommandSpanAttributes },
});
