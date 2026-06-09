// Admin org-members data-access. Server-safe Effects only — pages
// prefetch via the server-only sibling; client hooks live in
// `use-admin-org-members-queries.ts`. The `removeMember` mutation
// reuses the existing org-level endpoint (its policy already lets
// super-admins through), and on success invalidates this key so the
// member list re-reads.

import type { OrganizationContract } from "@org/contracts/api/Contracts";
import type { OrganizationId, UserId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";

import { QueryData } from "@/lib/tanstack-query";
import { ApiClient } from "@/services/api-client.shared";

type MembersKeyVars = { readonly orgId: OrganizationId };

const membersKey = QueryData.makeQueryKey<"admin-org-members", MembersKeyVars>("admin-org-members");
const membersHelpers = QueryData.makeHelpers<
  OrganizationContract.OrganizationMembersResponse,
  MembersKeyVars
>(membersKey);

export const adminOrgMembersQueryKey = membersKey;

export const adminOrgMembersQuery = (orgId: OrganizationId) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organizationAdmin.findMembers({ path: { orgId } }),
  );

export const removeOrgMember = (args: {
  readonly orgId: OrganizationId;
  readonly userId: UserId;
}) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.removeMember({ path: { orgId: args.orgId, userId: args.userId } }),
  ).pipe(Effect.tap(() => membersHelpers.invalidateAllQueries()));
