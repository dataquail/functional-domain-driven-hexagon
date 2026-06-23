"use client";

// Presenter for OrgPicker (ADR-0014 Tier 2). The root `/` page lists
// the caller's orgs as cards plus a create-org form; the picker only
// needs the list. We don't paginate — `findMine` returns the whole
// set (caller's memberships only) and a user with hundreds of orgs is
// outside the MVP shape.

import { useMyOrgsSuspenseQuery } from "@/services/data-access/use-orgs-queries";

export const useOrgPickerPresenter = () => {
  const orgsQuery = useMyOrgsSuspenseQuery();
  return { orgs: orgsQuery.data, isEmpty: orgsQuery.data.length === 0 };
};
