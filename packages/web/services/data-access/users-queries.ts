// Users data-access — server-safe Effects only. This file has NO
// `"use client"` directive so it can be imported and executed in both
// server components (for `prefetchEffectQuery`) and client components
// (transitively, via `use-users-queries.ts` which adds the suspense
// hook). Both runtimes provide the shared `ApiClient` tag, so the
// same Effect runs in either context — only the transport differs.

import { ApiClient } from "@/services/api-client.shared";
import * as Effect from "effect/Effect";

export type UsersListVariables = { page: number; pageSize: number };

export const usersQueryKey = (variables: UsersListVariables) => ["users", variables] as const;

// Return type is inferred — the error union (Unauthorized,
// HttpApiDecodeError, HttpClientError, ParseError) comes from the
// HttpApi contract and is propagated downstream so callers can
// `Effect.catchTag`/`useSuspenseQuery`'s error boundary can match on
// the tagged variants.
export const usersQuery = (variables: UsersListVariables) =>
  Effect.flatMap(ApiClient, ({ client }) => client.user.find({ urlParams: variables }));
