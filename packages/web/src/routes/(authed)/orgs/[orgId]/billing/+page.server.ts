// Billing is an org admin's: a member who deep-links here gets a 404. The
// billing endpoints refuse a member regardless; this is the clean UX.
import { error } from "@sveltejs/kit";

import { collectPrefetched } from "@/services/atom/prefetch.server";
import { prefetchSubscription } from "@/services/data-access/billing.server";

import type { load as orgLoad } from "../+layout.server";

export const load = async ({
  parent,
}: {
  readonly parent: () => Promise<Awaited<ReturnType<typeof orgLoad>>>;
}) => {
  const { isAdmin, orgId } = await parent();
  if (!isAdmin) error(404, "Not Found");
  return { prefetched: await collectPrefetched([prefetchSubscription(orgId)]) };
};
