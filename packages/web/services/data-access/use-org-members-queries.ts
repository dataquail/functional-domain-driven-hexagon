"use client";

import type { OrganizationId } from "@org/contracts/EntityIds";

import { useEffectMutation, useEffectSuspenseQuery } from "@/lib/tanstack-query";

import {
  demoteOrgMember,
  orgInvitationsQuery,
  orgInvitationsQueryKey,
  orgMembersQuery,
  orgMembersQueryKey,
  promoteOrgMember,
  removeOrgMember,
  resendOrgInvitation,
  revokeOrgInvitation,
} from "./org-members-queries";

export const useOrgMembersSuspenseQuery = (orgId: OrganizationId) =>
  useEffectSuspenseQuery({
    queryKey: orgMembersQueryKey({ orgId }),
    queryFn: () => orgMembersQuery(orgId),
  });

export const useOrgInvitationsSuspenseQuery = (orgId: OrganizationId) =>
  useEffectSuspenseQuery({
    queryKey: orgInvitationsQueryKey({ orgId }),
    queryFn: () => orgInvitationsQuery(orgId),
  });

export const useResendOrgInvitationMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgInvitations.resend"],
    mutationFn: resendOrgInvitation,
    toastifySuccess: () => "Invitation resent.",
    toastifyErrors: {
      OrganizationNotFoundError: (error) => error.message,
      InvitationNotFoundError: (error) => error.message,
      InvitationGoneError: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });

export const useRevokeOrgInvitationMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgInvitations.revoke"],
    mutationFn: revokeOrgInvitation,
    toastifySuccess: () => "Invitation revoked.",
    toastifyErrors: {
      OrganizationNotFoundError: (error) => error.message,
      InvitationNotFoundError: (error) => error.message,
      InvitationGoneError: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });

export const useRemoveOrgMemberMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgMembers.removeMember"],
    mutationFn: removeOrgMember,
    toastifySuccess: () => "Member removed.",
    toastifyErrors: {
      OrganizationNotFoundError: (error) => error.message,
      MembershipNotFoundError: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });

export const usePromoteOrgMemberMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgMembers.promoteMember"],
    mutationFn: promoteOrgMember,
    toastifySuccess: () => "Member promoted to admin.",
    toastifyErrors: {
      OrganizationNotFoundError: (error) => error.message,
      OrganizationRoleConflictError: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });

export const useDemoteOrgMemberMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgMembers.demoteMember"],
    mutationFn: demoteOrgMember,
    toastifySuccess: () => "Member demoted from admin.",
    toastifyErrors: {
      OrganizationNotFoundError: (error) => error.message,
      OrganizationRoleConflictError: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });
