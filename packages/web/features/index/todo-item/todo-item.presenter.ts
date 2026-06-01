"use client";

// Presenter for TodoItem (ADR-0014 Tier 2). Owns the
// useUpdateTodoMutation / useDeleteTodoMutation calls and the
// derived toggle/delete actions. View is pure JSX over the returned
// shape; behavior (mutation dispatch, optimistic flags, invalidation)
// is testable via the presenter without rendering JSX.

import type { TodosContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as React from "react";

import {
  useDeleteTodoMutation,
  useUpdateTodoMutation,
} from "@/services/data-access/use-todos-queries";

export const useTodoItemPresenter = (todo: TodosContract.Todo, orgId: OrganizationId) => {
  const updateTodo = useUpdateTodoMutation();
  const deleteTodo = useDeleteTodoMutation();

  const toggleCompleted = React.useCallback(() => {
    updateTodo.mutate({
      orgId,
      id: todo.id,
      payload: { title: todo.title, completed: !todo.completed },
    });
  }, [updateTodo, todo, orgId]);

  const deleteThis = React.useCallback(() => {
    deleteTodo.mutate({ orgId, id: todo.id });
  }, [deleteTodo, todo.id, orgId]);

  return {
    todo,
    toggleCompleted,
    deleteThis,
    isUpdating: updateTodo.isPending,
    isDeleting: deleteTodo.isPending,
  };
};
