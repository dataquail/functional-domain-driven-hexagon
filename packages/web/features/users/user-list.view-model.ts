// View-model for UserList pagination (ADR-0014 Tier 3).
//
// Pure data → data: takes the current page, page size, and total
// number of users; returns the derived display values used by the
// presenter. No React, no Effect runtime, no QueryClient — just
// math. Lives below the presenter so the math is testable without a
// renderer and reusable by any future surface (e.g. a CLI export
// pager, a story).

export type Pagination = {
  readonly currentPage: number;
  readonly pageSize: number;
  readonly total: number;
};

export type PaginationView = {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
  readonly isEmpty: boolean;
  readonly displayedRange: { readonly from: number; readonly to: number };
};

export const computePaginationView = (input: Pagination): PaginationView => {
  // Defensive against bad inputs even though presenter callers
  // never pass zero/negative values today. Total can be 0 if the
  // server returns an empty set; treat totalPages as 1 in that
  // case so the UI shows "Page 1 of 1" rather than "Page 1 of 0".
  const safePageSize = Math.max(1, input.pageSize);
  const safeTotal = Math.max(0, input.total);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const page = Math.min(Math.max(1, input.currentPage), totalPages);
  const isEmpty = safeTotal === 0;

  // 1-indexed inclusive range, clamped to the actual total.
  // Empty set: from === to === 0, signalling "no range".
  const from = isEmpty ? 0 : (page - 1) * safePageSize + 1;
  const to = isEmpty ? 0 : Math.min(page * safePageSize, safeTotal);

  return {
    page,
    pageSize: safePageSize,
    total: safeTotal,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    isEmpty,
    displayedRange: { from, to },
  };
};
