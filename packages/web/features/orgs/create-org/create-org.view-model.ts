// ViewModel for the create-organization form. On success it navigates into the
// freshly-created org, so the user is not left picking it back out of the
// switcher they just added it to.

import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { type FieldErrors, validateWithSchema } from "@/services/atom/form-validation";
import { navigateTo } from "@/services/atom/navigation.shared";
import { notify } from "@/services/atom/notifications.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";
import { createOrgAtom } from "@/services/data-access/orgs.atoms";

export type CreateOrgFields = {
  readonly name: string;
};

const EMPTY_FIELDS: CreateOrgFields = { name: "" };

const validate = validateWithSchema(OrganizationContract.CreateOrganizationPayload);

export const fieldsAtom = Atom.make<CreateOrgFields>(EMPTY_FIELDS);

export const submitAttemptedAtom = Atom.make(false);

export const errorsAtom = Atom.make((get): FieldErrors<CreateOrgFields> | null =>
  validate(get(fieldsAtom)),
);

export const visibleErrorsAtom = Atom.make((get): FieldErrors<CreateOrgFields> | null =>
  get(submitAttemptedAtom) ? get(errorsAtom) : null,
);

export const setNameAtom = Atom.fnSync<string>()((name, get) => {
  get.set(fieldsAtom, { ...get(fieldsAtom), name });
});

const createOrg = (get: Atom.FnContext) =>
  Effect.gen(function* () {
    const created = yield* get.setResult(createOrgAtom, {
      payload: new OrganizationContract.CreateOrganizationPayload(get(fieldsAtom)),
      reactivityKeys: ReactivityKeys.organizations,
    });

    get.set(fieldsAtom, EMPTY_FIELDS);
    get.set(submitAttemptedAtom, false);
    navigateTo(get, `/orgs/${created.id}`);
  }).pipe(notify(get, { success: () => "Organization created!" }));

export const submitAtom = ApiAtoms.runtime.fn<void>()((_, get) =>
  Effect.gen(function* () {
    get.set(submitAttemptedAtom, true);
    if (get(errorsAtom) !== null) return;
    yield* createOrg(get);
  }),
);
