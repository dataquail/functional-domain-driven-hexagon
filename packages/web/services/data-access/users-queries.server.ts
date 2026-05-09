// Server-only side of the users data-access port. Page-level prefetch
// helpers live here so the (server-only) `prefetchEffectQuery` import
// can't leak into a client bundle via `use-users-queries.ts`. Pages
// import from this file; the queryFn / queryKey / mutation Effects
// stay in the server-safe sibling. ADR-0014.

import "server-only";

import { prefetchEffectQuery } from "@/lib/tanstack-query/effect-prefetch.server";
import { type UsersListVariables, usersQuery, usersQueryKey } from "./users-queries";

export const prefetchUsers = (variables: UsersListVariables): Promise<void> =>
  prefetchEffectQuery({
    queryKey: usersQueryKey(variables),
    queryFn: usersQuery(variables),
  });
