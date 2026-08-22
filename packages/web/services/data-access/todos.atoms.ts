// Todos, as the Model sees them. Every endpoint is org-scoped, so `orgId` is
// part of the query's identity: two orgs get two atoms, two serialization keys
// and two hydration entries rather than sharing one slot.
//
// The request builder is shared between the atom and the prefetch on purpose.
// It is the one thing that could drift between the two paths, and a drift there
// is invisible -- the page would simply refetch on the client and nobody would
// notice the prefetch had stopped landing.

import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";

import { ApiClient } from "@/services/api-client.shared";
import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";

const todosRequest = (orgId: OrganizationId) => ({ params: { orgId } });

export const todosQueryAtom = (orgId: OrganizationId) =>
  ApiAtoms.query("todos", "get", {
    ...todosRequest(orgId),
    reactivityKeys: ReactivityKeys.todos,
    serializationKey: orgId,
  });

export const fetchTodos = (orgId: OrganizationId) =>
  Effect.flatMap(ApiClient, ({ client }) => client.todos.get(todosRequest(orgId)));

export const createTodoAtom = ApiAtoms.mutation("todos", "create");
export const updateTodoAtom = ApiAtoms.mutation("todos", "update");
export const deleteTodoAtom = ApiAtoms.mutation("todos", "delete");
