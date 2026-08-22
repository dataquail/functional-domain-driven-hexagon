// ViewModel for the create-user form. Field state, validation, submission and
// the notification policy all live here as atoms and Effects -- no form
// library, and nothing that needs a renderer to exercise.

import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { type FieldErrors, validateWithSchema } from "@/services/atom/form-validation";
import { notify } from "@/services/atom/notifications.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";
import { createUserAtom } from "@/services/data-access/users.atoms";

export type CreateUserFields = {
  readonly email: string;
  readonly country: string;
  readonly street: string;
  readonly postalCode: string;
};

export type CreateUserField = keyof CreateUserFields;

const EMPTY_FIELDS: CreateUserFields = {
  email: "",
  country: "",
  street: "",
  postalCode: "",
};

const validate = validateWithSchema(UserContract.CreateUserPayload);

export const fieldsAtom = Atom.make<CreateUserFields>(EMPTY_FIELDS);

// Validation runs continuously, but only surfaces once the user has tried to
// submit -- an empty form should not greet you with four errors.
export const submitAttemptedAtom = Atom.make(false);

export const errorsAtom = Atom.make((get): FieldErrors<CreateUserFields> | null =>
  validate(get(fieldsAtom)),
);

export const visibleErrorsAtom = Atom.make((get): FieldErrors<CreateUserFields> | null =>
  get(submitAttemptedAtom) ? get(errorsAtom) : null,
);

export const setFieldAtom = Atom.fnSync<{
  readonly field: CreateUserField;
  readonly value: string;
}>()(({ field, value }, get) => {
  get.set(fieldsAtom, { ...get(fieldsAtom), [field]: value });
});

// The notification wrapper stays *inside* the guard. Wrapping the whole
// action would announce "User created!" on the path where validation stopped
// us before we ever called the API.
const createUser = (get: Atom.FnContext) =>
  Effect.gen(function* () {
    yield* get.setResult(createUserAtom, {
      payload: new UserContract.CreateUserPayload(get(fieldsAtom)),
      reactivityKeys: ReactivityKeys.users,
    });

    get.set(fieldsAtom, EMPTY_FIELDS);
    get.set(submitAttemptedAtom, false);
  }).pipe(
    notify(get, {
      success: () => "User created!",
      errors: { UserAlreadyExistsError: (error) => error.message },
    }),
  );

export const submitAtom = ApiAtoms.runtime.fn<void>()((_, get) =>
  Effect.gen(function* () {
    get.set(submitAttemptedAtom, true);
    if (get(errorsAtom) !== null) return;
    yield* createUser(get);
  }),
);
