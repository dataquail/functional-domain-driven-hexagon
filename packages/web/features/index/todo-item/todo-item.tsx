"use client";

import {
  useDeleteTodoMutation,
  useUpdateTodoMutation,
} from "@/services/data-access/use-todos-queries";
import { Button } from "@org/components/primitives/button";
import { Checkbox } from "@org/components/primitives/checkbox";
import { TrashIcon } from "@org/components/primitives/icon";
import { Label } from "@org/components/primitives/label";
import type { TodosContract } from "@org/contracts/api/Contracts";

export const TodoItem: React.FC<{ todo: TodosContract.Todo }> = ({ todo }) => {
  const updateTodo = useUpdateTodoMutation();
  const deleteTodo = useDeleteTodoMutation();

  return (
    <li
      key={todo.id}
      data-testid="todo-item"
      data-todo-title={todo.title}
      className="group flex items-center justify-between rounded-md border bg-card p-3 transition-all hover:shadow-sm"
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
