// ViewModel for the todo list. Todos are org-scoped, so every atom here is a
// family keyed by the org: two orgs are two independent graphs rather than one
// graph that has to be told which org it is currently showing.

import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Array from "effect/Array";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

import { todosQueryAtom } from "@/services/data-access/todos.atoms";

export const todosResultAtom = Atom.family((orgId: OrganizationId) =>
  Atom.make((get) => get(todosQueryAtom(orgId))),
);

export type TodoListView = {
  readonly isEmpty: boolean;
};

export const todoListAtom = Atom.family((orgId: OrganizationId) =>
  Atom.make((get): TodoListView => {
    const result = get(todosResultAtom(orgId));
    return {
      isEmpty: AsyncResult.isSuccess(result) && Array.isReadonlyArrayEmpty(result.value),
    };
  }),
);
