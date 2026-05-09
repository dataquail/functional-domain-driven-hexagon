"use client";

import { useTodosSuspenseQuery } from "@/services/data-access/use-todos-queries";
import * as Array from "effect/Array";
import { TodoItem } from "./todo-item/todo-item";

export const TodoList: React.FC = () => {
  const { data: todos } = useTodosSuspenseQuery();

  if (todos.length === 0) {
    return (
      <div className="rounded-lg bg-muted/50 py-8 text-center">
        <p className="text-sm text-muted-foreground">No tasks yet. Add one above!</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" data-testid="todo-list">
      {Array.map(todos, (todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
};
