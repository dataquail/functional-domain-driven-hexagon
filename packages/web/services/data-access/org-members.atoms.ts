// The member-management surface, as the Model sees it: the roster, the open
// invitations, and the five writes that change either.
//
// One endpoint (`organization.findMembers`) backs both the org-admin members
// page and the super-admin drill-in -- super-admins pass the policy via the
// SuperAdminOnly OR chain, so there is no second listing to keep in step.

import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";

import { ApiClient } from "@/services/api-client.shared";
import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";

const orgRequest = (orgId: OrganizationId) => ({ params: { orgId } });

export const orgMembersQueryAtom = (orgId: OrganizationId) =>
  ApiAtoms.query("organization", "findMembers", {
    ...orgRequest(orgId),
    reactivityKeys: ReactivityKeys.organizationMembers,
    serializationKey: orgId,
  });

export const fetchOrgMembers = (orgId: OrganizationId) =>
  Effect.flatMap(ApiClient, ({ client }) => client.organization.findMembers(orgRequest(orgId)));

export const orgInvitationsQueryAtom = (orgId: OrganizationId) =>
  ApiAtoms.query("organization", "findInvitations", {
    ...orgRequest(orgId),
    reactivityKeys: ReactivityKeys.organizationInvitations,
    serializationKey: orgId,
  });

export const fetchOrgInvitations = (orgId: OrganizationId) =>
  Effect.flatMap(ApiClient, ({ client }) => client.organization.findInvitations(orgRequest(orgId)));

export const removeMemberAtom = ApiAtoms.mutation("organization", "removeMember");
export const promoteMemberAtom = ApiAtoms.mutation("organization", "promoteMember");
export const demoteMemberAtom = ApiAtoms.mutation("organization", "demoteMember");

export const resendInvitationAtom = ApiAtoms.mutation("organization", "resendInvitation");
export const revokeInvitationAtom = ApiAtoms.mutation("organization", "revokeInvitation");
export const inviteUserAtom = ApiAtoms.mutation("organization", "inviteUser");
