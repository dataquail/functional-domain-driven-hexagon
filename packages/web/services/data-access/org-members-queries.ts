// Org-members data-access. Server-safe Effects only — pages prefetch
// via the server-only sibling; client hooks live in
// `use-org-members-queries.ts`. One endpoint (`organization.findMembers`,
// `update`-gated) backs both the org-admin members page and the
// super-admin drill-in: super-admins pass the policy via the
// SuperAdminOnly OR chain. The mutations (remove / promote / demote)
// invalidate this key on success so the list re-reads.

import type { OrganizationContract } from "@org/contracts/api/Contracts";
import type { InvitationId, OrganizationId, UserId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";

import { QueryData } from "@/lib/tanstack-query";
import { ApiClient } from "@/services/api-client.shared";

type MembersKeyVars = { readonly orgId: OrganizationId };

const membersKey = QueryData.makeQueryKey<"org-members", MembersKeyVars>("org-members");
const membersHelpers = QueryData.makeHelpers<
  OrganizationContract.OrganizationMembersResponse,
  MembersKeyVars
>(membersKey);

export const orgMembersQueryKey = membersKey;

export const orgMembersQuery = (orgId: OrganizationId) =>
  Effect.flatMap(ApiClient, ({ client }) => client.organization.findMembers({ path: { orgId } }));

// Pending invitations (open: not yet accepted, not revoked) for the
// member-management surface's "Pending invitations" section. Resend and
// revoke invalidate this key so the section re-reads.
type InvitationsKeyVars = { readonly orgId: OrganizationId };

const invitationsKey = QueryData.makeQueryKey<"org-invitations", InvitationsKeyVars>(
  "org-invitations",
);
const invitationsHelpers = QueryData.makeHelpers<
  OrganizationContract.PendingInvitationsResponse,
  InvitationsKeyVars
>(invitationsKey);

export const orgInvitationsQueryKey = invitationsKey;

export const orgInvitationsQuery = (orgId: OrganizationId) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.findInvitations({ path: { orgId } }),
  );

export const resendOrgInvitation = (args: {
  readonly orgId: OrganizationId;
  readonly invitationId: InvitationId;
}) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.resendInvitation({
      path: { orgId: args.orgId, invitationId: args.invitationId },
    }),
  ).pipe(Effect.tap(() => invitationsHelpers.invalidateAllQueries()));

export const revokeOrgInvitation = (args: {
  readonly orgId: OrganizationId;
  readonly invitationId: InvitationId;
}) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.revokeInvitation({
      path: { orgId: args.orgId, invitationId: args.invitationId },
    }),
  ).pipe(Effect.tap(() => invitationsHelpers.invalidateAllQueries()));

export const removeOrgMember = (args: {
  readonly orgId: OrganizationId;
  readonly userId: UserId;
}) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.removeMember({ path: { orgId: args.orgId, userId: args.userId } }),
  ).pipe(Effect.tap(() => membersHelpers.invalidateAllQueries()));

export const promoteOrgMember = (args: {
  readonly orgId: OrganizationId;
  readonly userId: UserId;
}) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.promoteMember({ path: { orgId: args.orgId, userId: args.userId } }),
  ).pipe(Effect.tap(() => membersHelpers.invalidateAllQueries()));

export const demoteOrgMember = (args: {
  readonly orgId: OrganizationId;
  readonly userId: UserId;
}) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.demoteMember({ path: { orgId: args.orgId, userId: args.userId } }),
  ).pipe(Effect.tap(() => membersHelpers.invalidateAllQueries()));
