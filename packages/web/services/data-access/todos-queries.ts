// Todos data-access — server-safe Effects only. This file has NO
// `"use client"` so it imports/runs in both server components (for
// the page-level `prefetchTodos` call in todos-queries.server.ts)
// and client components (transitively, via use-todos-queries.ts
// which adds the suspense + mutation hooks).
//
// Every operation is org-scoped (Phase 5): the contract paths are
// `/orgs/:orgId/todos[/:id]`, so `orgId` is required up front. The
// query key includes it so two orgs don't share a cache slot.
//
// Mutations chain `todosHelpers.invalidateAllQueries()` so the read
// cache refreshes after writes (across all per-org keys in the
// namespace). The helper depends on `QueryClient` (provided by the
// client runtime); on the server we don't run mutations, so the
// helper's R is satisfied only client-side.

import { TodosContract } from "@org/contracts/api/Contracts";
import type { OrganizationId, TodoId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";

import { QueryData } from "@/lib/tanstack-query";
import { ApiClient } from "@/services/api-client.shared";

type TodosKeyVars = { readonly orgId: OrganizationId };

const todosKey = QueryData.makeQueryKey<"todos", TodosKeyVars>("todos");
const todosHelpers = QueryData.makeHelpers<Array<TodosContract.Todo>, TodosKeyVars>(todosKey);

export const todosQueryKey = todosKey;

export const todosQuery = (orgId: OrganizationId) =>
  Effect.flatMap(ApiClient, ({ client }) => client.todos.get({ params: { orgId } }));

export const createTodo = (args: {
  readonly orgId: OrganizationId;
  readonly payload: TodosContract.CreateTodoPayload;
}) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.todos.create({
      params: { orgId: args.orgId },
      payload: new TodosContract.CreateTodoPayload(args.payload),
    }),
  ).pipe(Effect.tap(() => todosHelpers.invalidateAllQueries()));

export const updateTodo = (args: {
  readonly orgId: OrganizationId;
  readonly id: TodoId;
  readonly payload: TodosContract.UpdateTodoPayload;
}) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.todos.update({
      params: { orgId: args.orgId, id: args.id },
      payload: new TodosContract.UpdateTodoPayload(args.payload),
    }),
  ).pipe(Effect.tap(() => todosHelpers.invalidateAllQueries()));

export const deleteTodo = (args: { readonly orgId: OrganizationId; readonly id: TodoId }) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.todos.delete({ params: { orgId: args.orgId, id: args.id } }),
  ).pipe(Effect.tap(() => todosHelpers.invalidateAllQueries()));
