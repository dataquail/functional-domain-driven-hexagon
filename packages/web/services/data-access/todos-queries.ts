// Todos data-access — server-safe Effects only. This file has NO
// `"use client"` so it imports/runs in both server components (for
// the page-level `prefetchTodos` call in todos-queries.server.ts)
// and client components (transitively, via use-todos-queries.ts
// which adds the suspense + mutation hooks).
//
// Mutations chain `todosHelpers.invalidateAllQueries()` so the read
// cache refreshes after writes. The helper depends on `QueryClient`
// (provided by the client runtime); on the server we don't run
// mutations, so the helper's R is satisfied only client-side.

import { QueryData } from "@/lib/tanstack-query";
import { ApiClient } from "@/services/api-client.shared";
import type { TodosContract } from "@org/contracts/api/Contracts";
import type { TodoId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";

const todosKey = QueryData.makeQueryKey("todos");
const todosHelpers = QueryData.makeHelpers<Array<TodosContract.Todo>>(todosKey);

export const todosQueryKey = todosKey;

export const todosQuery = Effect.flatMap(ApiClient, ({ client }) => client.todos.get());

export const createTodo = (todo: TodosContract.CreateTodoPayload) =>
  Effect.flatMap(ApiClient, ({ client }) => client.todos.create({ payload: todo })).pipe(
    Effect.tap(() => todosHelpers.invalidateAllQueries()),
  );

export const updateTodo = (todo: TodosContract.Todo) =>
  Effect.flatMap(ApiClient, ({ client }) => client.todos.update({ payload: todo })).pipe(
    Effect.tap(() => todosHelpers.invalidateAllQueries()),
  );

export const deleteTodo = (id: TodoId) =>
  Effect.flatMap(ApiClient, ({ client }) => client.todos.delete({ payload: id })).pipe(
    Effect.tap(() => todosHelpers.invalidateAllQueries()),
  );
