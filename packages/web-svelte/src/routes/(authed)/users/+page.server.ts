import { PAGE_SIZE } from "@/features/users/user-list.view-model";
import { collectPrefetched } from "@/services/atom/prefetch.server";
import { prefetchUsers } from "@/services/data-access/users.server";

export const load = async () => ({
  prefetched: await collectPrefetched([prefetchUsers({ page: 1, pageSize: PAGE_SIZE })]),
});
