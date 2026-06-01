"use client";

// Presenter for TodoList (ADR-0014 Tier 2). Owns the suspense-query
// call and the empty-vs-populated split so the view file is pure JSX.

import type { OrganizationId } from "@org/contracts/EntityIds";

import { useTodosSuspenseQuery } from "@/services/data-access/use-todos-queries";

export const useTodoListPresenter = (orgId: OrganizationId) => {
  const { data: todos } = useTodosSuspenseQuery(orgId);
  return { todos, isEmpty: todos.length === 0, orgId };
};
