"use client";

// Client-side hook for prefetched data. Pair with `prefetchEffectQuery`
// + `<HydrationBoundary>` on a server page: the cache is populated
// server-side, hydration ships it to the browser, and this hook reads
// it synchronously on first paint. On invalidation or stale-time
// expiry, the same `queryFn` runs in the browser.
//
// Phase 2 keeps the runtime requirement minimal: the caller passes an
// `Effect<A, E, never>` (i.e. all dependencies pre-provided). Phase 4
// generalizes this to take an `Effect<A, E, R>` where `R` is satisfied
// by the client RuntimeProvider, mirroring `useEffectQuery` on the
// existing SPA. The split keeps Phase 2 small while still proving the
// prefetch → hydrate → suspense pipeline end-to-end.
//
// Errors throw out of the hook (that's how `useSuspenseQuery` works).
// Wrap the consuming subtree in an `error.tsx` boundary; the toast
// path used by `useEffectQuery` (via `useRunner`) is intentionally not
// applied here — server-prefetched failures are a routing concern, not
// a UI-feedback concern.

import {
  type QueryKey,
  useSuspenseQuery,
  type UseSuspenseQueryResult,
} from "@tanstack/react-query";
import * as Cause from "effect/Cause";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

export class QueryDefect extends Data.TaggedError("QueryDefect")<{
  cause: unknown;
}> {}

export const useEffectSuspenseQuery = <A, E>(args: {
  queryKey: QueryKey;
  queryFn: Effect.Effect<A, E, never>;
}): UseSuspenseQueryResult<A, E | QueryDefect> =>
  useSuspenseQuery<A, E | QueryDefect>({
    queryKey: args.queryKey,
    queryFn: () =>
      Effect.runPromiseExit(args.queryFn).then(
        Exit.match({
          onSuccess: (value) => value,
          onFailure: (cause) => {
            if (Cause.isFailType(cause)) throw cause.error satisfies E;
            throw new QueryDefect({ cause: Cause.squash(cause) });
          },
        }),
      ),
  });
