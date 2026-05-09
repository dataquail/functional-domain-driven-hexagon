"use client";

// Client-side users hooks. Wraps the environment-agnostic Effects from
// `users-queries.ts` with `useEffectSuspenseQuery`, which runs them on
// the browser-side `RuntimeProvider`. Pair with a server-side
// `prefetchEffectQuery(usersQuery({...}))` and `<HydrationBoundary>` to
// get data on first paint.

import { useEffectSuspenseQuery } from "@/lib/tanstack-query/use-effect-suspense-query";
import { type UsersListVariables, usersQuery, usersQueryKey } from "./users-queries";

// Generic params on `useEffectSuspenseQuery` are inferred — the error
// union flows through from the HttpApi contract via `usersQuery`.
export const useUsersSuspenseQuery = (variables: UsersListVariables) =>
  useEffectSuspenseQuery({
    queryKey: usersQueryKey(variables),
    queryFn: () => usersQuery(variables),
  });
