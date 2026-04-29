import { Button, Checkbox, Label, TrashIcon } from "@/components/primitives";
import { TodosQueries } from "@/services/data-access/todos-queries";
import type { TodosContract } from "@org/contracts/api/Contracts";
import React from "react";

export const TodoItem: React.FC<{ todo: TodosContract.Todo }> = ({ todo }) => {
  const updateTodo = TodosQueries.useUpdateTodoMutation();
  const deleteTodo = TodosQueries.useDeleteTodoMutation();

  return (
    <li
      key={todo.id}
      className="bg-card group flex items-center justify-between rounded-md border p-3 transition-all hover:shadow-sm"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Checkbox
          id={`todo-${todo.id}`}
          checked={todo.completed}
          onCheckedChange={() => {
            updateTodo.mutate({
              ...todo,
              completed: !todo.completed,
            });
          }}
        />

        <Label
          htmlFor={`todo-${todo.id}`}
          className={`flex-1 cursor-pointer truncate ${
            todo.completed ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {todo.title}
        </Label>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => {
          deleteTodo.mutate(todo.id);
        }}
      >
        <TrashIcon tone="destructive" />
        <span className="sr-only">Delete</span>
      </Button>
    </li>
  );
};
