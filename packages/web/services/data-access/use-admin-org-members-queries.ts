"use client";

import type { OrganizationId } from "@org/contracts/EntityIds";

import { useEffectMutation, useEffectSuspenseQuery } from "@/lib/tanstack-query";

import {
  adminOrgMembersQuery,
  adminOrgMembersQueryKey,
  removeOrgMember,
} from "./admin-org-members-queries";

export const useAdminOrgMembersSuspenseQuery = (orgId: OrganizationId) =>
  useEffectSuspenseQuery({
    queryKey: adminOrgMembersQueryKey({ orgId }),
    queryFn: () => adminOrgMembersQuery(orgId),
  });

export const useRemoveOrgMemberMutation = () =>
  useEffectMutation({
    mutationKey: ["AdminOrgMembers.removeMember"],
    mutationFn: removeOrgMember,
    toastifySuccess: () => "Member removed.",
    toastifyErrors: {
      OrganizationNotFoundError: (error) => error.message,
      MembershipNotFoundError: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });
