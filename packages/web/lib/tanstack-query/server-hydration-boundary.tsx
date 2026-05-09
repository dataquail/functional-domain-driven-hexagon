// Page-level wrapper that hides TanStack's prefetch + dehydrate
// + hydrate pipeline behind a single component. App Router pages
// compose `await`-able prefetch helpers from `services/data-access/`
// with this boundary instead of touching `dehydrate`,
// `HydrationBoundary`, `prefetchEffectQuery`, or the per-request
// QueryClient directly. Enforced by the `web-app-no-tanstack-internals`
// rule in `.dependency-cruiser.cjs`. ADR-0014.
//
// `prefetch` is a tuple of in-flight Promises (the per-feature
// prefetch wrappers from `services/data-access/`). They run in
// parallel before the inner subtree renders; on completion the
// per-request QueryClient is dehydrated into the boundary so the
// browser hydrates from cache on first paint with no client spinner.
//
// Suspense is bundled here because every prefetch+hydrate page wants
// it: the inner client subtree reads via `useSuspenseQuery`, which
// throws while the (already hydrated) cache is being deserialized
// during navigations and refetches. Pages supply their own skeleton
// via `fallback`.

import "server-only";

import { getQueryClient } from "@/lib/query-client.server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import * as React from "react";

export const ServerHydrationBoundary = async ({
  children,
  fallback,
  prefetch = [],
}: {
  readonly prefetch?: ReadonlyArray<Promise<unknown>>;
  readonly fallback: React.ReactNode;
  readonly children: React.ReactNode;
}): Promise<React.ReactElement> => {
  await Promise.all(prefetch);
  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <React.Suspense fallback={fallback}>{children}</React.Suspense>
    </HydrationBoundary>
  );
};
