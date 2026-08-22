import "server-only";

import { HydrationBoundary } from "@effect/atom-react";
import type * as Hydration from "effect/unstable/reactivity/Hydration";
import * as React from "react";

import { collectPrefetched } from "./prefetch.server";

// One component for the whole server-to-browser handoff: run the route's
// prefetches, hand the encoded results to the registry, and hold the client
// subtree behind a Suspense boundary while it mounts.
//
// Routes compose this rather than the pieces, so `app/` never names the
// registry, the dehydration format, or the Atom library.

export const AtomHydrationBoundary = async ({
  children,
  fallback,
  prefetch = [],
}: {
  readonly prefetch?: ReadonlyArray<Promise<Hydration.DehydratedAtom | null>>;
  readonly fallback: React.ReactNode;
  readonly children: React.ReactNode;
}): Promise<React.ReactElement> => {
  const state = await collectPrefetched(prefetch);
  return (
    <HydrationBoundary state={state}>
      <React.Suspense fallback={fallback}>{children}</React.Suspense>
    </HydrationBoundary>
  );
};
