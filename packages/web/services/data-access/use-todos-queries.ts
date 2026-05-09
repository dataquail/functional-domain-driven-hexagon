"use client";

// Client-side todos hooks. Wraps `todosQuery` from todos-queries.ts
// with `useEffectSuspenseQuery` so the prefetched cache is read on
// first paint without a client round-trip.

import { useEffectSuspenseQuery } from "@/lib/tanstack-query/use-effect-suspense-query";
import { todosQuery, todosQueryKey } from "./todos-queries";

export const useTodosSuspenseQuery = () =>
  useEffectSuspenseQuery({
    queryKey: todosQueryKey(),
    queryFn: () => todosQuery,
  });
