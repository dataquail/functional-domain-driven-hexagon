import { OrganizationId } from "@org/contracts/EntityIds";

import { collectPrefetched } from "@/services/atom/prefetch.server";
import { prefetchTodos } from "@/services/data-access/todos.server";

export const load = async ({ params }: { readonly params: { readonly orgId: string } }) => ({
  prefetched: await collectPrefetched([prefetchTodos(OrganizationId.make(params.orgId))]),
});
