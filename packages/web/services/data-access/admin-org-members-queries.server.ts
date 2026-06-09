import "server-only";

import type { OrganizationId } from "@org/contracts/EntityIds";

import { prefetchEffectQuery } from "@/lib/tanstack-query/effect-prefetch.server";

import { adminOrgMembersQuery, adminOrgMembersQueryKey } from "./admin-org-members-queries";

export const prefetchAdminOrgMembers = (orgId: OrganizationId): Promise<void> =>
  prefetchEffectQuery({
    queryKey: adminOrgMembersQueryKey({ orgId }),
    queryFn: adminOrgMembersQuery(orgId),
  });
