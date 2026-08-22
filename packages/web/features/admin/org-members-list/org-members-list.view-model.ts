// ViewModel for the organization member roster: the rows it renders and the
// three writes a row offers.
//
// Every atom here is a family keyed by the organization, so the super-admin
// drill-in and an org-admin's own members page are two independent graphs
// rather than one that has to be told which org it is currently showing.

import type { OrganizationId, UserId } from "@org/contracts/EntityIds";
import * as Array from "effect/Array";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { notify } from "@/services/atom/notifications.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";
import {
  demoteMemberAtom,
  orgMembersQueryAtom,
  promoteMemberAtom,
  removeMemberAtom,
} from "@/services/data-access/org-members.atoms";
import { formatDay } from "@/services/format/date.shared";

export type MemberRowView = {
  readonly userId: UserId;
  readonly email: string;
  readonly joinedAtLabel: string;
  readonly isAdmin: boolean;
};

export type OrgMembersListView = {
  readonly rows: ReadonlyArray<MemberRowView>;
  readonly isEmpty: boolean;
};

export const orgMembersResultAtom = Atom.family((orgId: OrganizationId) =>
  Atom.make((get) => get(orgMembersQueryAtom(orgId))),
);

export const orgMembersListAtom = Atom.family((orgId: OrganizationId) =>
  Atom.make((get): OrgMembersListView => {
    const result = get(orgMembersResultAtom(orgId));
    const members = AsyncResult.isSuccess(result) ? result.value.members : [];
    return {
      rows: Array.map(members, (member) => ({
        userId: member.userId,
        email: member.email,
        joinedAtLabel: formatDay(member.joinedAt),
        isAdmin: member.isAdmin,
      })),
      isEmpty: AsyncResult.isSuccess(result) && Array.isReadonlyArrayEmpty(members),
    };
  }),
);

export type MemberAction = {
  readonly orgId: OrganizationId;
  readonly userId: UserId;
};

const memberKeys = ReactivityKeys.organizationMembers;

export const removeMemberActionAtom = ApiAtoms.runtime.fn<MemberAction>()(
  ({ orgId, userId }, get) =>
    get.setResult(removeMemberAtom, { params: { orgId, userId }, reactivityKeys: memberKeys }).pipe(
      notify(get, {
        success: () => "Member removed.",
        errors: {
          OrganizationNotFoundError: (error) => error.message,
          MembershipNotFoundError: (error) => error.message,
          Forbidden: (error) => error.message,
        },
      }),
    ),
);

export const promoteMemberActionAtom = ApiAtoms.runtime.fn<MemberAction>()(
  ({ orgId, userId }, get) =>
    get
      .setResult(promoteMemberAtom, { params: { orgId, userId }, reactivityKeys: memberKeys })
      .pipe(
        notify(get, {
          success: () => "Member promoted to admin.",
          errors: {
            OrganizationNotFoundError: (error) => error.message,
            OrganizationRoleConflictError: (error) => error.message,
            Forbidden: (error) => error.message,
          },
        }),
      ),
);

export const demoteMemberActionAtom = ApiAtoms.runtime.fn<MemberAction>()(
  ({ orgId, userId }, get) =>
    get.setResult(demoteMemberAtom, { params: { orgId, userId }, reactivityKeys: memberKeys }).pipe(
      notify(get, {
        success: () => "Member demoted from admin.",
        errors: {
          OrganizationNotFoundError: (error) => error.message,
          OrganizationRoleConflictError: (error) => error.message,
          Forbidden: (error) => error.message,
        },
      }),
    ),
);

// One in-flight role change at a time, so a member cannot be double-promoted
// mid-flight by an impatient second click.
export const isChangingRoleAtom = Atom.make(
  (get): boolean => get(promoteMemberActionAtom).waiting || get(demoteMemberActionAtom).waiting,
);

export const isRemovingAtom = Atom.make((get): boolean => get(removeMemberActionAtom).waiting);
