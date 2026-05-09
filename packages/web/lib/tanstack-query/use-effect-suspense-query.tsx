"use client";

// Client-side hook for prefetched data. Pair with `prefetchEffectQuery`
// + `<HydrationBoundary>` on a server page: the cache is populated
// server-side, hydration ships it to the browser, and this hook reads
// it synchronously on first paint. On invalidation or stale-time
// expiry, the same `queryFn` runs in the browser through the client
// `RuntimeProvider`.
//
// Phase 4 generalizes this from the Phase 2 placeholder: the queryFn
// can now depend on any service the client runtime provides
// (`ClientRuntimeContext`), mirroring `useEffectQuery` in the existing
// SPA. The runtime is injected automatically — caller passes a thunk
// that returns the Effect, like the existing `useEffectQuery` shape.
//
// Errors throw out of the hook (that's how `useSuspenseQuery` works).
// Wrap the consuming subtree in an `error.tsx` boundary; the toast
// path used by `useEffectQuery` (via `useRunner`) is intentionally not
// applied here — server-prefetched failures are a routing concern, not
// a UI-feedback concern.

import { type ClientRuntimeContext, useRuntime } from "@/services/runtime.client";
import {
  type QueryKey,
  useSuspenseQuery,
  type UseSuspenseQueryResult,
} from "@tanstack/react-query";
import * as Cause from "effect/Cause";
import * as Data from "effect/Data";
import type * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as React from "react";

export class QueryDefect extends Data.TaggedError("QueryDefect")<{
  cause: unknown;
}> {}

type EffectfulError<Tag extends string = string> = { _tag: Tag };

export const useEffectSuspenseQuery = <
  A,
  E extends EffectfulError,
  R extends ClientRuntimeContext,
>(args: {
  queryKey: QueryKey;
  queryFn: () => Effect.Effect<A, E, R>;
}): UseSuspenseQueryResult<A, E | QueryDefect> => {
  const runtime = useRuntime();
  const { queryFn: effectfulQueryFn } = args;

  const queryFn = React.useCallback(
    () =>
      runtime.runPromiseExit(effectfulQueryFn()).then(
        Exit.match({
          onSuccess: (value) => value,
          onFailure: (cause) => {
            if (Cause.isFailType(cause)) throw cause.error satisfies E;
            throw new QueryDefect({ cause: Cause.squash(cause) });
          },
        }),
      ),
    [runtime, effectfulQueryFn],
  );

  return useSuspenseQuery<A, E | QueryDefect>({
    queryKey: args.queryKey,
    queryFn,
  });
};
