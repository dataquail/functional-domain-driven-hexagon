// Server-only side of the todos data-access port. Page-level prefetch
// helpers live here so the (server-only) `prefetchEffectQuery` import
// can't leak into a client bundle via `use-todos-queries.ts`. Pages
// import from this file; the queryFn / queryKey / mutation Effects
// stay in the server-safe sibling. ADR-0014.

import "server-only";

import { prefetchEffectQuery } from "@/lib/tanstack-query/effect-prefetch.server";
import { todosQuery, todosQueryKey } from "./todos-queries";

export const prefetchTodos = (): Promise<void> =>
  prefetchEffectQuery({ queryKey: todosQueryKey(), queryFn: todosQuery });
