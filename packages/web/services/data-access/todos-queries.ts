// Todos data-access — server-safe Effects only. Same split as
// users-queries.ts: this file has NO `"use client"` so it imports/runs
// in both server components (for `prefetchEffectQuery`) and client
// components (transitively, via use-todos-queries.ts).
//
// Mutation surface (create/update/delete) is intentionally NOT ported
// in this Phase 4 follow-up. The read-side proves prefetch+suspense on
// a second route; mutations bring in `useEffectMutation`, Toast, and
// the QueryClient invalidation helpers — those land at Phase 6
// cutover when the existing client's full mutation tier moves over.

import { ApiClient } from "@/services/api-client.shared";
import * as Effect from "effect/Effect";

export const todosQueryKey = () => ["todos"] as const;

export const todosQuery = Effect.flatMap(ApiClient, ({ client }) => client.todos.get());
