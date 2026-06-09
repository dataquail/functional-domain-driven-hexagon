"use client";

// Presenter for the super-admin OrgsList. Owns pagination state +
// "include deleted" toggle and the soft-delete / restore mutations.
// The list refetches via queryKey when either knob changes, exactly
// like UserList does for its page knob.

import * as React from "react";

import {
  useAdminOrgsSuspenseQuery,
  useRestoreOrganizationMutation,
  useSoftDeleteOrganizationMutation,
} from "@/services/data-access/use-orgs-queries";

import { computeOrgsListView, type OrgRowView } from "./orgs-list.view-model";

const DEFAULT_PAGE_SIZE = 10;

export const useOrgsListPresenter = (opts?: { readonly pageSize?: number }) => {
  const pageSize = opts?.pageSize ?? DEFAULT_PAGE_SIZE;
  const [page, setPage] = React.useState(1);
  const [includeDeleted, setIncludeDeleted] = React.useState<"true" | "false">("false");

  const orgsQuery = useAdminOrgsSuspenseQuery({ page, pageSize, includeDeleted });
  const softDelete = useSoftDeleteOrganizationMutation();
  const restore = useRestoreOrganizationMutation();

  const view = computeOrgsListView({ response: orgsQuery.data });

  const goPrev = React.useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);
  const goNext = React.useCallback(() => {
    setPage((p) => Math.min(view.totalPages, p + 1));
  }, [view.totalPages]);
  const toggleIncludeDeleted = React.useCallback(() => {
    setIncludeDeleted((v) => (v === "true" ? "false" : "true"));
    setPage(1);
  }, []);

  const onSoftDelete = React.useCallback(
    (row: OrgRowView) => {
      softDelete.mutate({ id: row.id });
    },
    [softDelete],
  );

  const onRestore = React.useCallback(
    (row: OrgRowView) => {
      restore.mutate({ id: row.id });
    },
    [restore],
  );

  return {
    ...view,
    includeDeleted: includeDeleted === "true",
    toggleIncludeDeleted,
    goPrev,
    goNext,
    onSoftDelete,
    onRestore,
  };
};
