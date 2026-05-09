"use client";

// Phase 4 follow-up: read-only port of packages/client/src/features/
// index/. The existing SPA renders this list via a full view-model
// (state machine, observable Stream, worker actions, AddTodo
// presenter, TodoItem with toggle/delete mutations). For Phase 4
// completion we ship the read side only — empty state, list of todos
// with completion styling, no interactive bits. The full mutation +
// worker port lands at Phase 6 cutover.
//
// Suspense is the data-loading UX: the `<Suspense fallback>` in
// page.tsx renders skeletons; this component never sees a `pending`
// state because it runs after data is in cache.

import { useTodosSuspenseQuery } from "@/services/data-access/use-todos-queries";
import * as Array from "effect/Array";

export const TodoList: React.FC = () => {
  const { data: todos } = useTodosSuspenseQuery();

  if (todos.length === 0) {
    return (
      <div className="rounded-lg bg-muted/50 py-8 text-center">
        <p className="text-sm text-muted-foreground">No tasks yet.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" data-testid="todo-list">
      {Array.map(todos, (todo) => (
        <li
          key={todo.id}
          data-testid="todo-item"
          data-todo-title={todo.title}
          className="flex items-center gap-3 rounded-md border bg-card p-3"
        >
          <span
            aria-hidden="true"
            className={`flex size-4 shrink-0 items-center justify-center rounded-sm border ${
              todo.completed ? "border-primary bg-primary text-primary-foreground" : "border-input"
            }`}
          >
            {todo.completed ? "✓" : null}
          </span>
          <span
            className={`flex-1 truncate text-sm ${
              todo.completed ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {todo.title}
          </span>
        </li>
      ))}
    </ul>
  );
};
