// Server-side prefetch helper. Runs an Effect on the per-request server
// runtime and writes the result into the per-request QueryClient under
// the given key. Pair with `<HydrationBoundary state={dehydrate(qc)}>`
// in the page so the cache ships to the browser; the leaf component
// uses `useEffectSuspenseQuery` with the same key and reads from
// the hydrated cache without a network round-trip.
//
// `prefetchQuery` swallows errors by design — a failed prefetch leaves
// the cache empty and the client either retries (regular `useQuery`) or
// throws on read (`useSuspenseQuery`). The `useSuspenseQuery` path is
// what we want: errors surface at the nearest `error.tsx` boundary
// rather than dragging the whole tree into a generic 500.
import "server-only";

import { getQueryClient } from "@/lib/query-client.server";
import type { ApiClient } from "@/services/api-client.server";
import { getServerRuntime } from "@/services/runtime.server";
import type { QueryKey } from "@tanstack/react-query";
import type * as Effect from "effect/Effect";

export const prefetchEffectQuery = async <A, E>(args: {
  queryKey: QueryKey;
  queryFn: Effect.Effect<A, E, ApiClient>;
}): Promise<void> => {
  const queryClient = getQueryClient();
  const runtime = await getServerRuntime();
  await queryClient.prefetchQuery({
    queryKey: args.queryKey,
    queryFn: () => runtime.runPromise(args.queryFn),
  });
};
