"use client";

// Client-side users hooks. Wraps the environment-agnostic Effects
// from `users-queries.ts` with `useEffectSuspenseQuery` (read) and
// `useEffectMutation` (create). Pair with a server-side
// `prefetchEffectQuery(usersQuery({...}))` and `<HydrationBoundary>`
// to get data on first paint.

import { useEffectMutation, useEffectSuspenseQuery } from "@/lib/tanstack-query";
import { createUser, type UsersListVariables, usersQuery, usersQueryKey } from "./users-queries";

// Generic params on `useEffectSuspenseQuery` are inferred — the error
// union flows through from the HttpApi contract via `usersQuery`.
export const useUsersSuspenseQuery = (variables: UsersListVariables) =>
  useEffectSuspenseQuery({
    queryKey: usersQueryKey(variables),
    queryFn: () => usersQuery(variables),
  });

export const useCreateUserMutation = () =>
  useEffectMutation({
    mutationKey: ["UsersQueries.createUser"],
    mutationFn: createUser,
    toastifySuccess: () => "User created!",
    toastifyErrors: {
      UserAlreadyExistsError: (error) => error.message,
    },
  });
