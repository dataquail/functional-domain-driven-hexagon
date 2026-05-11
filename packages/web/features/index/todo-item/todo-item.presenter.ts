"use client";

// Presenter for TodoItem (ADR-0014 Tier 2). Owns the
// useUpdateTodoMutation / useDeleteTodoMutation calls and the
// derived toggle/delete actions. View is pure JSX over the returned
// shape; behavior (mutation dispatch, optimistic flags, invalidation)
// is testable via the presenter without rendering JSX.

import {
  useDeleteTodoMutation,
  useUpdateTodoMutation,
} from "@/services/data-access/use-todos-queries";
import type { TodosContract } from "@org/contracts/api/Contracts";
import * as React from "react";

export const useTodoItemPresenter = (todo: TodosContract.Todo) => {
  const updateTodo = useUpdateTodoMutation();
  const deleteTodo = useDeleteTodoMutation();

  const toggleCompleted = React.useCallback(() => {
    updateTodo.mutate({ ...todo, completed: !todo.completed });
  }, [updateTodo, todo]);

  const deleteThis = React.useCallback(() => {
    deleteTodo.mutate(todo.id);
  }, [deleteTodo, todo.id]);

  return {
    todo,
    toggleCompleted,
    deleteThis,
    isUpdating: updateTodo.isPending,
    isDeleting: deleteTodo.isPending,
  };
};
