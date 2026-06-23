import "server-only";

import type { OrganizationId } from "@org/contracts/EntityIds";

import { prefetchEffectQuery } from "@/lib/tanstack-query/effect-prefetch.server";

import {
  orgInvitationsQuery,
  orgInvitationsQueryKey,
  orgMembersQuery,
  orgMembersQueryKey,
} from "./org-members-queries";

export const prefetchOrgMembers = (orgId: OrganizationId): Promise<void> =>
  prefetchEffectQuery({
    queryKey: orgMembersQueryKey({ orgId }),
    queryFn: orgMembersQuery(orgId),
  });

export const prefetchOrgInvitations = (orgId: OrganizationId): Promise<void> =>
  prefetchEffectQuery({
    queryKey: orgInvitationsQueryKey({ orgId }),
    queryFn: orgInvitationsQuery(orgId),
  });
