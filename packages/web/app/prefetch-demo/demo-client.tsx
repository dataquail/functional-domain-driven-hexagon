"use client";

import { useEffectSuspenseQuery } from "@/lib/tanstack-query/use-effect-suspense-query";
import { type QueryKey } from "@tanstack/react-query";
import * as Effect from "effect/Effect";

// The queryFn here is a fallback. On first paint it's not called —
// the data was prefetched on the server and hydrated. After the
// stale-time elapses or on manual invalidation, the same Effect runs
// in the browser. For the Phase 2 demo it's a constant Effect; Phase 4
// generalizes the hook so an Effect that depends on the client runtime
// (ApiClient, etc.) can be passed here too.
type DemoData = { message: string; renderedAt: string };

export const DemoClient: React.FC<{ queryKey: QueryKey }> = ({ queryKey }) => {
  const { data } = useEffectSuspenseQuery({
    queryKey,
    queryFn: () =>
      Effect.succeed<DemoData>({
        message: "Refetched on the client (you should not normally see this)",
        renderedAt: new Date().toISOString(),
      }),
  });

  return (
    <section
      data-testid="prefetch-demo-payload"
      className="rounded-md border bg-card p-4 font-mono text-sm"
    >
      <p>
        <span className="font-semibold">message:</span> {data.message}
      </p>
      <p>
        <span className="font-semibold">renderedAt:</span> {data.renderedAt}
      </p>
    </section>
  );
};
