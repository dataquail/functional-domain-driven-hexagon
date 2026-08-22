// ViewModel for the invite-a-teammate form. The 403 a non-admin caller gets is
// a notification, not a crash -- the page stays put with what they typed.

import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { type FieldErrors, validateWithSchema } from "@/services/atom/form-validation";
import { notify } from "@/services/atom/notifications.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";
import { inviteUserAtom } from "@/services/data-access/org-members.atoms";

export type InviteFields = {
  readonly email: string;
};

const EMPTY_FIELDS: InviteFields = { email: "" };

const validate = validateWithSchema(OrganizationContract.InviteUserPayload);

export const fieldsAtom = Atom.make<InviteFields>(EMPTY_FIELDS);

export const submitAttemptedAtom = Atom.make(false);

export const errorsAtom = Atom.make((get): FieldErrors<InviteFields> | null =>
  validate(get(fieldsAtom)),
);

export const visibleErrorsAtom = Atom.make((get): FieldErrors<InviteFields> | null =>
  get(submitAttemptedAtom) ? get(errorsAtom) : null,
);

export const setEmailAtom = Atom.fnSync<string>()((email, get) => {
  get.set(fieldsAtom, { ...get(fieldsAtom), email });
});

const invite = (orgId: OrganizationId, get: Atom.FnContext) =>
  Effect.gen(function* () {
    yield* get.setResult(inviteUserAtom, {
      params: { orgId },
      payload: new OrganizationContract.InviteUserPayload(get(fieldsAtom)),
      reactivityKeys: ReactivityKeys.organizationInvitations,
    });

    get.set(fieldsAtom, EMPTY_FIELDS);
    get.set(submitAttemptedAtom, false);
  }).pipe(
    notify(get, {
      success: () => "Invitation sent.",
      errors: {
        OrganizationNotFoundError: (error) => error.message,
        Forbidden: (error) => error.message,
      },
    }),
  );

export const submitAtom = ApiAtoms.runtime.fn<OrganizationId>()((orgId, get) =>
  Effect.gen(function* () {
    get.set(submitAttemptedAtom, true);
    if (get(errorsAtom) !== null) return;
    yield* invite(orgId, get);
  }),
);
