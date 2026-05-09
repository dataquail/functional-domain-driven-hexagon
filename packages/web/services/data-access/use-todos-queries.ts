"use client";

// Client-side todos hooks. Wraps the server-safe Effects from
// todos-queries.ts with `useEffectSuspenseQuery` (read) and
// `useEffectMutation` (writes). Mutations toast on success and use
// the same in-flight feedback the existing SPA used.

import { useEffectMutation, useEffectSuspenseQuery } from "@/lib/tanstack-query";
import { createTodo, deleteTodo, todosQuery, todosQueryKey, updateTodo } from "./todos-queries";

export const useTodosSuspenseQuery = () =>
  useEffectSuspenseQuery({
    queryKey: todosQueryKey(),
    queryFn: () => todosQuery,
  });

export const useCreateTodoMutation = () =>
  useEffectMutation({
    mutationKey: ["TodosQueries.createTodo"],
    mutationFn: createTodo,
    toastifySuccess: () => "Todo created!",
  });

export const useUpdateTodoMutation = () =>
  useEffectMutation({
    mutationKey: ["TodosQueries.updateTodo"],
    mutationFn: updateTodo,
    toastifySuccess: () => "Todo updated!",
  });

export const useDeleteTodoMutation = () =>
  useEffectMutation({
    mutationKey: ["TodosQueries.deleteTodo"],
    mutationFn: deleteTodo,
    toastifySuccess: () => "Todo deleted!",
    toastifyErrors: {
      TodoNotFoundError: (error) => error.message,
    },
  });
