"use client";

// Presenter for UserList (ADR-0014 Tier 2). Owns pagination state and
// the suspense-query call so the view file is pure JSX over the
// returned shape. Page changes drive new fetches via the queryKey
// (page is part of the variables).

import { useUsersSuspenseQuery } from "@/services/data-access/use-users-queries";
import * as React from "react";

const DEFAULT_PAGE_SIZE = 10;

export const useUserListPresenter = (opts?: { readonly pageSize?: number }) => {
  const pageSize = opts?.pageSize ?? DEFAULT_PAGE_SIZE;
  const [page, setPage] = React.useState(1);

  const usersQuery = useUsersSuspenseQuery({ page, pageSize });

  const total = usersQuery.data.total;
  const users = usersQuery.data.users;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isEmpty = users.length === 0;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const goPrev = React.useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const goNext = React.useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  return {
    users,
    total,
    page,
    pageSize,
    totalPages,
    isEmpty,
    hasPrev,
    hasNext,
    goPrev,
    goNext,
  };
};
