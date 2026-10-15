// The roster is member-readable; the management controls and pending
// invitations are an admin's. The parent layout already knows the caller's role.
import type { OrganizationId } from "@org/contracts/EntityIds";

import { collectPrefetched, type Prefetch } from "@/services/atom/prefetch.server";
import {
  prefetchOrgInvitations,
  prefetchOrgMembers,
} from "@/services/data-access/org-members.server";

import type { load as orgLoad } from "../+layout.server";

const invitationPrefetches = (isAdmin: boolean, orgId: OrganizationId): ReadonlyArray<Prefetch> => {
  if (isAdmin) return [prefetchOrgInvitations(orgId)];

  return [];
};

export const load = async ({
  parent,
}: {
  readonly parent: () => Promise<Awaited<ReturnType<typeof orgLoad>>>;
}) => {
  const { isAdmin, orgId } = await parent();

  return {
    members: await collectPrefetched([prefetchOrgMembers(orgId)]),
    invitations: await collectPrefetched(invitationPrefetches(isAdmin, orgId)),
  };
};
