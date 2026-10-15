// A super-admin's drill-in to one org: its members and pending invitations.
// No todos -- a super-admin enters an org to manage membership, not content.
import { OrganizationId } from "@org/contracts/EntityIds";

import { collectPrefetched } from "@/services/atom/prefetch.server";
import {
  prefetchOrgInvitations,
  prefetchOrgMembers,
} from "@/services/data-access/org-members.server";

export const load = async ({ params }: { readonly params: { readonly orgId: string } }) => {
  const orgId = OrganizationId.make(params.orgId);

  return {
    orgId,
    members: await collectPrefetched([prefetchOrgMembers(orgId)]),
    invitations: await collectPrefetched([prefetchOrgInvitations(orgId)]),
  };
};
