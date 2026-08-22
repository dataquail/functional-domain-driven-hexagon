// ViewModel for the add-todo form. One field, but the same shape as every
// other form here: fields as state, validation as a derived atom, and a submit
// action that guards before it announces anything.

import { TodosContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { type FieldErrors, validateWithSchema } from "@/services/atom/form-validation";
import { notify } from "@/services/atom/notifications.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";
import { createTodoAtom } from "@/services/data-access/todos.atoms";

export type AddTodoFields = {
  readonly title: string;
};

const EMPTY_FIELDS: AddTodoFields = { title: "" };

const validate = validateWithSchema(TodosContract.CreateTodoPayload);

export const fieldsAtom = Atom.make<AddTodoFields>(EMPTY_FIELDS);

// Validation runs continuously, but only surfaces once the user has tried to
// submit -- an empty form should not greet you with an error.
export const submitAttemptedAtom = Atom.make(false);

export const errorsAtom = Atom.make((get): FieldErrors<AddTodoFields> | null =>
  validate(get(fieldsAtom)),
);

export const visibleErrorsAtom = Atom.make((get): FieldErrors<AddTodoFields> | null =>
  get(submitAttemptedAtom) ? get(errorsAtom) : null,
);

export const setTitleAtom = Atom.fnSync<string>()((title, get) => {
  get.set(fieldsAtom, { ...get(fieldsAtom), title });
});

// The notification wrapper stays *inside* the guard. Wrapping the whole
// action would announce "Todo created!" on the path where validation stopped
// us before we ever called the API.
const createTodo = (orgId: OrganizationId, get: Atom.FnContext) =>
  Effect.gen(function* () {
    yield* get.setResult(createTodoAtom, {
      params: { orgId },
      payload: new TodosContract.CreateTodoPayload(get(fieldsAtom)),
      reactivityKeys: ReactivityKeys.todos,
    });

    get.set(fieldsAtom, EMPTY_FIELDS);
    get.set(submitAttemptedAtom, false);
  }).pipe(notify(get, { success: () => "Todo created!" }));

export const submitAtom = ApiAtoms.runtime.fn<OrganizationId>()((orgId, get) =>
  Effect.gen(function* () {
    get.set(submitAttemptedAtom, true);
    if (get(errorsAtom) !== null) return;
    yield* createTodo(orgId, get);
  }),
);
