// Server-only prefetch helpers for organization data-access. The
// `prefetchEffectQuery` import is server-only; keeping it out of the
// client-side `use-orgs-queries.ts` ensures the bundle stays clean.

import "server-only";

import { prefetchEffectQuery } from "@/lib/tanstack-query/effect-prefetch.server";

import {
  adminOrgsQuery,
  adminOrgsQueryKey,
  type AdminOrgsVariables,
  myOrgsQuery,
  myOrgsQueryKey,
} from "./orgs-queries";

export const prefetchMyOrgs = (): Promise<void> =>
  prefetchEffectQuery({ queryKey: myOrgsQueryKey(), queryFn: myOrgsQuery });

export const prefetchAdminOrgs = (variables: AdminOrgsVariables): Promise<void> =>
  prefetchEffectQuery({
    queryKey: adminOrgsQueryKey(variables),
    queryFn: adminOrgsQuery(variables),
  });
