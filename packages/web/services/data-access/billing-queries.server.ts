// Server-only prefetch helper for the billing panel. The page's
// suspense boundary throws while it loads, so prefetching here means
// the panel paints from cache on first render.

import "server-only";

import type { OrganizationId } from "@org/contracts/EntityIds";

import { prefetchEffectQuery } from "@/lib/tanstack-query/effect-prefetch.server";

import { billingQueryKey, currentSubscriptionQuery } from "./billing-queries";

export const prefetchCurrentSubscription = (orgId: OrganizationId): Promise<void> =>
  prefetchEffectQuery({
    queryKey: billingQueryKey({ orgId }),
    queryFn: currentSubscriptionQuery(orgId),
  });
