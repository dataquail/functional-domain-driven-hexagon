"use client";

// Presenter for OrgSwitcher (ADR-0014 Tier 2). The org list is
// hydrated from a `useSuspenseQuery` (server-prefetched in the
// (authed) layout); pathname comes from Next's client router so the
// active-id derivation re-runs on navigation without a refetch.

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { useMyOrgsSuspenseQuery } from "@/services/data-access/use-orgs-queries";

import { computeOrgSwitcherView } from "./org-switcher.view-model";

export const useOrgSwitcherPresenter = () => {
  const router = useRouter();
  const pathname = usePathname();
  const orgsQuery = useMyOrgsSuspenseQuery();

  const view = computeOrgSwitcherView({ orgs: orgsQuery.data, pathname });

  const onSelect = React.useCallback(
    (orgId: string) => {
      const next = view.options.find((o) => o.id === orgId);
      if (next !== undefined) router.push(next.href);
    },
    [router, view.options],
  );

  const onCreateNew = React.useCallback(() => {
    router.push("/");
  }, [router]);

  return {
    activeOrgId: view.activeOrgId,
    options: view.options,
    isEmpty: view.isEmpty,
    onSelect,
    onCreateNew,
  };
};
