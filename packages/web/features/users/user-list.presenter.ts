"use client";

// Presenter for UserList (ADR-0014 Tier 2). Owns React state and
// the suspense-query call; defers all pagination math to the
// `user-list.view-model.ts` Tier-3 module. Page changes drive new
// fetches via the queryKey (page is part of the variables).

import { useUsersSuspenseQuery } from "@/services/data-access/use-users-queries";
import * as React from "react";
import { computePaginationView } from "./user-list.view-model";

const DEFAULT_PAGE_SIZE = 10;

export const useUserListPresenter = (opts?: { readonly pageSize?: number }) => {
  const pageSize = opts?.pageSize ?? DEFAULT_PAGE_SIZE;
  const [page, setPage] = React.useState(1);

  const usersQuery = useUsersSuspenseQuery({ page, pageSize });
  const users = usersQuery.data.users;

  const view = computePaginationView({
    currentPage: page,
    pageSize,
    total: usersQuery.data.total,
  });

  const goPrev = React.useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const goNext = React.useCallback(() => {
    setPage((p) => Math.min(view.totalPages, p + 1));
  }, [view.totalPages]);

  return {
    users,
    total: view.total,
    page: view.page,
    pageSize: view.pageSize,
    totalPages: view.totalPages,
    isEmpty: view.isEmpty,
    hasPrev: view.hasPrev,
    hasNext: view.hasNext,
    displayedRange: view.displayedRange,
    goPrev,
    goNext,
  };
};
