import { PAGE_SIZE } from "@/features/admin/orgs-list/orgs-list.view-model";
import { collectPrefetched } from "@/services/atom/prefetch.server";
import { prefetchAdminOrgs } from "@/services/data-access/orgs.server";

export const load = async () => ({
  prefetched: await collectPrefetched([
    prefetchAdminOrgs({ page: 1, pageSize: PAGE_SIZE, includeDeleted: "false" }),
  ]),
});
