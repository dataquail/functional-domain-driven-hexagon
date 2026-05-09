// Users data-access — server-safe Effects only. This file has NO
// `"use client"` directive so it can be imported and executed in both
// server components (for the page-level `prefetchUsers` call in
// users-queries.server.ts) and client components (transitively, via
// `use-users-queries.ts` which adds the suspense hook + mutation
// hook). Both runtimes provide the shared `ApiClient` tag, so the
// same Effect runs in either context — only the transport differs.

import { QueryData } from "@/lib/tanstack-query";
import { ApiClient } from "@/services/api-client.shared";
import type { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

export type UsersListVariables = { page: number; pageSize: number };

const usersKey = QueryData.makeQueryKey<"users", UsersListVariables>("users");
const usersHelpers = QueryData.makeHelpers<UserContract.PaginatedUsers, UsersListVariables>(
  usersKey,
);

export const usersQueryKey = usersKey;

// Return type is inferred — the error union (Unauthorized,
// HttpApiDecodeError, HttpClientError, ParseError) comes from the
// HttpApi contract and is propagated downstream so callers can
// `Effect.catchTag`/`useSuspenseQuery`'s error boundary can match on
// the tagged variants.
export const usersQuery = (variables: UsersListVariables) =>
  Effect.flatMap(ApiClient, ({ client }) => client.user.find({ urlParams: variables }));

export const createUser = (payload: UserContract.CreateUserPayload) =>
  Effect.flatMap(ApiClient, ({ client }) => client.user.create({ payload })).pipe(
    Effect.tap(() => usersHelpers.invalidateAllQueries()),
  );
