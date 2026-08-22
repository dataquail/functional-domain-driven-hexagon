// ViewModel for the pending-invitations section of the member-management
// surface: the open invitations and the two writes each row offers.

import type { InvitationId, OrganizationId } from "@org/contracts/EntityIds";
import * as Array from "effect/Array";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { notify } from "@/services/atom/notifications.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";
import {
  orgInvitationsQueryAtom,
  resendInvitationAtom,
  revokeInvitationAtom,
} from "@/services/data-access/org-members.atoms";
import { formatDay } from "@/services/format/date.shared";

export type InvitationRowView = {
  readonly invitationId: InvitationId;
  readonly email: string;
  readonly isExpired: boolean;
  readonly expiresAtLabel: string;
};

export type OrgInvitationsListView = {
  readonly rows: ReadonlyArray<InvitationRowView>;
  readonly isEmpty: boolean;
};

export const orgInvitationsResultAtom = Atom.family((orgId: OrganizationId) =>
  Atom.make((get) => get(orgInvitationsQueryAtom(orgId))),
);

export const orgInvitationsListAtom = Atom.family((orgId: OrganizationId) =>
  Atom.make((get): OrgInvitationsListView => {
    const result = get(orgInvitationsResultAtom(orgId));
    const invitations = AsyncResult.isSuccess(result) ? result.value.invitations : [];
    return {
      rows: Array.map(invitations, (invitation) => ({
        invitationId: invitation.invitationId,
        email: invitation.inviteeEmail,
        isExpired: invitation.status === "expired",
        expiresAtLabel: formatDay(invitation.expiresAt),
      })),
      isEmpty: AsyncResult.isSuccess(result) && Array.isReadonlyArrayEmpty(invitations),
    };
  }),
);

export type InvitationAction = {
  readonly orgId: OrganizationId;
  readonly invitationId: InvitationId;
};

const invitationKeys = ReactivityKeys.organizationInvitations;

const INVITATION_ERRORS = {
  OrganizationNotFoundError: (error: { readonly message: string }) => error.message,
  InvitationNotFoundError: (error: { readonly message: string }) => error.message,
  InvitationGoneError: (error: { readonly message: string }) => error.message,
  Forbidden: (error: { readonly message: string }) => error.message,
} as const;

export const resendInvitationActionAtom = ApiAtoms.runtime.fn<InvitationAction>()(
  ({ invitationId, orgId }, get) =>
    get
      .setResult(resendInvitationAtom, {
        params: { orgId, invitationId },
        reactivityKeys: invitationKeys,
      })
      .pipe(notify(get, { success: () => "Invitation resent.", errors: INVITATION_ERRORS })),
);

export const revokeInvitationActionAtom = ApiAtoms.runtime.fn<InvitationAction>()(
  ({ invitationId, orgId }, get) =>
    get
      .setResult(revokeInvitationAtom, {
        params: { orgId, invitationId },
        reactivityKeys: invitationKeys,
      })
      .pipe(notify(get, { success: () => "Invitation revoked.", errors: INVITATION_ERRORS })),
);

export const isResendingAtom = Atom.make((get): boolean => get(resendInvitationActionAtom).waiting);

export const isRevokingAtom = Atom.make((get): boolean => get(revokeInvitationActionAtom).waiting);
