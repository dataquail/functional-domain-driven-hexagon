// ViewModel for a single todo row: the two writes it can make, and what each
// one announces. The todo itself is passed in rather than looked up -- the row
// is rendered from the list's already-fetched page, so re-reading it here would
// be a second source of truth for the same value.

import { TodosContract } from "@org/contracts/api/Contracts";
import type { OrganizationId, TodoId } from "@org/contracts/EntityIds";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { notify } from "@/services/atom/notifications.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";
import { deleteTodoAtom, updateTodoAtom } from "@/services/data-access/todos.atoms";

export type ToggleTodoInput = {
  readonly orgId: OrganizationId;
  readonly todo: TodosContract.Todo;
};

export type DeleteTodoInput = {
  readonly orgId: OrganizationId;
  readonly id: TodoId;
};

export const toggleTodoAtom = ApiAtoms.runtime.fn<ToggleTodoInput>()(({ orgId, todo }, get) =>
  get
    .setResult(updateTodoAtom, {
      params: { orgId, id: todo.id },
      payload: new TodosContract.UpdateTodoPayload({
        title: todo.title,
        completed: !todo.completed,
      }),
      reactivityKeys: ReactivityKeys.todos,
    })
    .pipe(
      notify(get, {
        success: () => "Todo updated!",
        errors: { TodoNotFoundError: (error) => error.message },
      }),
    ),
);

export const deleteTodoActionAtom = ApiAtoms.runtime.fn<DeleteTodoInput>()(({ id, orgId }, get) =>
  get
    .setResult(deleteTodoAtom, {
      params: { orgId, id },
      reactivityKeys: ReactivityKeys.todos,
    })
    .pipe(
      notify(get, {
        success: () => "Todo deleted!",
        errors: { TodoNotFoundError: (error) => error.message },
      }),
    ),
);
