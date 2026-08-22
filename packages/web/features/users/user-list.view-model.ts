// ViewModel for the user list: page state, the query it drives, and the
// derived pagination view. No React, no JSX, no atom-react -- everything here
// runs under a bare `AtomRegistry` in a test.

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

import { usersQueryAtom } from "@/services/data-access/users.atoms";

export const PAGE_SIZE = 10;

export type PaginationView = {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly isEmpty: boolean;
  readonly displayedRange: { readonly from: number; readonly to: number };
};

export const computePaginationView = (input: {
  readonly currentPage: number;
  readonly pageSize: number;
  readonly total: number;
}): PaginationView => {
  const safePageSize = Math.max(1, input.pageSize);
  const safeTotal = Math.max(0, input.total);
  // An empty set still occupies one page, so the UI reads "Page 1 of 1" rather
  // than the nonsensical "Page 1 of 0".
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const page = Math.min(Math.max(1, input.currentPage), totalPages);
  const isEmpty = safeTotal === 0;

  return {
    page,
    pageSize: safePageSize,
    total: safeTotal,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    isEmpty,
    displayedRange: {
      from: isEmpty ? 0 : (page - 1) * safePageSize + 1,
      to: isEmpty ? 0 : Math.min(page * safePageSize, safeTotal),
    },
  };
};

export const pageAtom = Atom.make(1);

export const usersResultAtom = Atom.make((get) =>
  get(usersQueryAtom({ page: get(pageAtom), pageSize: PAGE_SIZE })),
);

export const paginationAtom = Atom.make((get): PaginationView => {
  const result = get(usersResultAtom);
  return computePaginationView({
    currentPage: get(pageAtom),
    pageSize: PAGE_SIZE,
    total: AsyncResult.isSuccess(result) ? result.value.total : 0,
  });
});

export type PageChange = "next" | "previous";

export const changePageAtom = Atom.fnSync<PageChange>()((direction, get) => {
  const view = get(paginationAtom);
  get.set(
    pageAtom,
    direction === "next" ? Math.min(view.totalPages, view.page + 1) : Math.max(1, view.page - 1),
  );
});
