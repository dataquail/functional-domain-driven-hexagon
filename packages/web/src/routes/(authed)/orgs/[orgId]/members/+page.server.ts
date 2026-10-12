// The roster is member-readable; the management controls and pending
// invitations are an admin's. The parent layout already knows the caller's role.
import { collectPrefetched } from "@/services/atom/prefetch.server";
import {
  prefetchOrgInvitations,
  prefetchOrgMembers,
} from "@/services/data-access/org-members.server";

import type { load as orgLoad } from "../+layout.server";

export const load = async ({
  parent,
}: {
  readonly parent: () => Promise<Awaited<ReturnType<typeof orgLoad>>>;
}) => {
  const { isAdmin, orgId } = await parent();
  return {
    members: await collectPrefetched([prefetchOrgMembers(orgId)]),
    invitations: await collectPrefetched(isAdmin ? [prefetchOrgInvitations(orgId)] : []),
  };
};
