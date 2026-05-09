"use client";

// Phase 6 port of packages/client/src/features/index/. Replaces the
// Phase 4 follow-up's read-only placeholder with the full mutation
// surface — toggle and delete via TodoItem. Worker actions
// (filterLargeData, calculatePrimes) are intentionally skipped per
// the migration plan (academic for the template).

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
