// Phase 2 smoke test. Demonstrates the prefetch → dehydrate → hydrate →
// suspense pipeline end-to-end:
//
//  1. The server runtime resolves on this request (proves the
//     ApiClient/CookieHeader layer builds; cookies() doesn't reject).
//  2. `prefetchEffectQuery` runs an Effect server-side and writes the
//     result into the per-request QueryClient cache.
//  3. `<HydrationBoundary>` ships the dehydrated cache to the browser.
//  4. `<DemoClient>` reads the same key with `useSuspenseQuery` — no
//     client-side fetch happens, the data is already in cache.
//
// Verify in DevTools: open Network tab on first load, see the SSR'd
// HTML contains the timestamp; reloading shows no `/api/*` request.
//
// This file is in `app/` and not part of the lint surface yet (see
// packages/web/README.md). Phase 6 cutover folds the package into the
// main lint glob.

import { getQueryClient } from "@/lib/query-client.server";
import { prefetchEffectQuery } from "@/lib/tanstack-query/effect-prefetch.server";
import { getServerRuntime } from "@/services/runtime.server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import * as Effect from "effect/Effect";
import { Suspense } from "react";
import { DemoClient } from "./demo-client";

const DEMO_QUERY_KEY = ["prefetch-demo"] as const;

export default async function PrefetchDemoPage() {
  // Build the runtime to prove the layer resolves under a real request.
  // The instance is unused below (the demo Effect has R = never), but
  // constructing it exercises the cookie read + ApiClientLive layer.
  await getServerRuntime();

  await prefetchEffectQuery({
    queryKey: DEMO_QUERY_KEY,
    queryFn: Effect.succeed({
      message: "Prefetched on the server",
      renderedAt: new Date().toISOString(),
    }),
  });

  const queryClient = getQueryClient();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Prefetch demo</h1>
        <p className="text-sm text-muted-foreground">
          The data below is prefetched on the server and hydrated into the browser&rsquo;s
          QueryClient. <code className="font-mono">useSuspenseQuery</code> reads it synchronously on
          first paint — no client-side fetch.
        </p>
      </header>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <DemoClient queryKey={DEMO_QUERY_KEY} />
        </Suspense>
      </HydrationBoundary>
    </main>
  );
}
