"use client";

// Presenter for TodoList (ADR-0014 Tier 2). Owns the suspense-query
// call and the empty-vs-populated split so the view file is pure JSX.

import { useTodosSuspenseQuery } from "@/services/data-access/use-todos-queries";

export const useTodoListPresenter = () => {
  const { data: todos } = useTodosSuspenseQuery();
  return { todos, isEmpty: todos.length === 0 };
};
