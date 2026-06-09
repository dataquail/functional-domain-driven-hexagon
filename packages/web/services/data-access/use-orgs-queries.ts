"use client";

// Client-side organization hooks. Pairs with the server-only prefetch
// helpers in `orgs-queries.server.ts` and the environment-agnostic
// Effects in `orgs-queries.ts`. Toasts are descriptive on success and
// echo tagged error messages on the cases the UI surfaces.

import { useEffectMutation, useEffectSuspenseQuery } from "@/lib/tanstack-query";

import {
  acceptInvitation,
  adminOrgsQuery,
  adminOrgsQueryKey,
  type AdminOrgsVariables,
  createOrganization,
  inviteUser,
  leaveOrganization,
  myOrgsQuery,
  myOrgsQueryKey,
  removeMember,
  restoreOrganization,
  revokeInvitation,
  softDeleteOrganization,
} from "./orgs-queries";

export const useMyOrgsSuspenseQuery = () =>
  useEffectSuspenseQuery({ queryKey: myOrgsQueryKey(), queryFn: () => myOrgsQuery });

export const useAdminOrgsSuspenseQuery = (variables: AdminOrgsVariables) =>
  useEffectSuspenseQuery({
    queryKey: adminOrgsQueryKey(variables),
    queryFn: () => adminOrgsQuery(variables),
  });

export const useCreateOrganizationMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgsQueries.create"],
    mutationFn: createOrganization,
    toastifySuccess: () => "Organization created!",
  });

export const useSoftDeleteOrganizationMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgsQueries.softDelete"],
    mutationFn: softDeleteOrganization,
    toastifySuccess: () => "Organization deleted.",
    toastifyErrors: {
      OrganizationNotFoundError: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });

export const useRestoreOrganizationMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgsQueries.restore"],
    mutationFn: restoreOrganization,
    toastifySuccess: () => "Organization restored.",
    toastifyErrors: {
      OrganizationNotFoundError: (error) => error.message,
      OrganizationNotDeletedError: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });

export const useInviteUserMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgsQueries.inviteUser"],
    mutationFn: inviteUser,
    toastifySuccess: () => "Invitation sent.",
    toastifyErrors: {
      OrganizationNotFoundError: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });

export const useRevokeInvitationMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgsQueries.revokeInvitation"],
    mutationFn: revokeInvitation,
    toastifySuccess: () => "Invitation revoked.",
    toastifyErrors: {
      InvitationNotFoundError: (error) => error.message,
      InvitationGoneError: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });

export const useAcceptInvitationMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgsQueries.acceptInvitation"],
    mutationFn: acceptInvitation,
    toastifySuccess: () => "Invitation accepted!",
    toastifyErrors: {
      InvitationNotFoundError: (error) => error.message,
      InvitationGoneError: (error) => error.message,
    },
  });

export const useRemoveMemberMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgsQueries.removeMember"],
    mutationFn: removeMember,
    toastifySuccess: () => "Member removed.",
    toastifyErrors: {
      MembershipNotFoundError: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });

export const useLeaveOrganizationMutation = () =>
  useEffectMutation({
    mutationKey: ["OrgsQueries.leave"],
    mutationFn: leaveOrganization,
    toastifySuccess: () => "Left organization.",
    toastifyErrors: {
      MembershipNotFoundError: (error) => error.message,
    },
  });
