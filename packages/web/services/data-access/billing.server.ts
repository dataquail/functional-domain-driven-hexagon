import "server-only";

import type { OrganizationId } from "@org/contracts/EntityIds";

import { prefetchQuery } from "@/services/atom/prefetch.server";

import { fetchRawSubscription, rawSubscriptionQueryAtom } from "./billing.atoms";

// An org with no subscription yet prefetches nothing -- the 404 yields no
// hydration entry, and the client's own fetch folds it back into "no
// subscription". One extra request in the empty case, no special casing here.
export const prefetchSubscription = (orgId: OrganizationId) =>
  prefetchQuery(rawSubscriptionQueryAtom(orgId), fetchRawSubscription(orgId));
