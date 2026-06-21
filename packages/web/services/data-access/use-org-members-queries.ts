"use client";

import type { OrganizationId } from "@org/contracts/EntityIds";

import { useEffectMutation, useEffectSuspenseQuery } from "@/lib/tanstack-query";

import {
  demoteOrgMember,
  orgMembersQuery,
  orgMembersQueryKey,
  promoteOrgMember,
  removeOrgMember,
} from "./org-members-queries";

export const useOrgMembersSuspenseQuery = (orgId: OrganizationId) =>
  useEffectSuspenseQuery({
    queryKey: orgMembersQueryKey({ orgId }),
    queryFn: () => orgMembersQuery(orgId),
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
