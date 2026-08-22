// ViewModel for the super-admin organizations list: the two knobs (page, and
// whether soft-deleted orgs are shown), the query they drive, the per-row
// display state, and the two writes a row offers.
//
// A soft-delete or restore dirties both organization keys. The platform listing
// obviously changes; so does every affected member's own switcher, and only the
// second key reaches that.

import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Array from "effect/Array";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { notify } from "@/services/atom/notifications.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";
import {
  adminOrgsQueryAtom,
  restoreOrgAtom,
  softDeleteOrgAtom,
} from "@/services/data-access/orgs.atoms";
import { formatDay, formatDayOrNull } from "@/services/format/date.shared";

export const PAGE_SIZE = 10;

export type OrgRowView = {
  readonly id: OrganizationId;
  readonly name: string;
  readonly createdAtLabel: string;
  readonly isDeleted: boolean;
  readonly deletedAtLabel: string | null;
  readonly href: string | null;
};

export type OrgsListView = {
  readonly rows: ReadonlyArray<OrgRowView>;
  readonly page: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly isEmpty: boolean;
  readonly includeDeleted: boolean;
};

export const pageAtom = Atom.make(1);
export const includeDeletedAtom = Atom.make(false);

export const adminOrgsResultAtom = Atom.make((get) =>
  get(
    adminOrgsQueryAtom({
      page: get(pageAtom),
      pageSize: PAGE_SIZE,
      includeDeleted: get(includeDeletedAtom) ? "true" : "false",
    }),
  ),
);

export const orgsListAtom = Atom.make((get): OrgsListView => {
  const result = get(adminOrgsResultAtom);
  const page = AsyncResult.isSuccess(result) ? result.value : null;
  const total = Math.max(0, page?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, get(pageAtom)), totalPages);

  const rows = Array.map(page?.organizations ?? [], (org): OrgRowView => {
    const isDeleted = org.deletedAt !== null;
    return {
      id: org.id,
      name: org.name,
      createdAtLabel: formatDay(org.createdAt),
      isDeleted,
      deletedAtLabel: formatDayOrNull(org.deletedAt),
      // A deleted org has no detail page to visit, so the row is plain text.
      href: isDeleted ? null : `/admin/orgs/${org.id}`,
    };
  });

  return {
    rows,
    page: currentPage,
    total,
    totalPages,
    hasPrevious: currentPage > 1,
    hasNext: currentPage < totalPages,
    isEmpty: page !== null && Array.isReadonlyArrayEmpty(rows),
    includeDeleted: get(includeDeletedAtom),
  };
});

export type PageChange = "next" | "previous";

export const changePageAtom = Atom.fnSync<PageChange>()((direction, get) => {
  const view = get(orgsListAtom);
  get.set(
    pageAtom,
    direction === "next" ? Math.min(view.totalPages, view.page + 1) : Math.max(1, view.page - 1),
  );
});

// Flipping the filter changes how many rows exist, so the current page number
// may no longer address anything. Going back to the first page is the only
// answer that is always meaningful.
export const toggleIncludeDeletedAtom = Atom.fnSync<void>()((_, get) => {
  get.set(includeDeletedAtom, !get(includeDeletedAtom));
  get.set(pageAtom, 1);
});

const ORGANIZATION_KEYS = [...ReactivityKeys.organizations, ...ReactivityKeys.adminOrganizations];

export const softDeleteOrgActionAtom = ApiAtoms.runtime.fn<OrganizationId>()((id, get) =>
  get.setResult(softDeleteOrgAtom, { params: { id }, reactivityKeys: ORGANIZATION_KEYS }).pipe(
    notify(get, {
      success: () => "Organization deleted.",
      errors: {
        OrganizationNotFoundError: (error) => error.message,
        Forbidden: (error) => error.message,
      },
    }),
  ),
);

export const restoreOrgActionAtom = ApiAtoms.runtime.fn<OrganizationId>()((id, get) =>
  get.setResult(restoreOrgAtom, { params: { id }, reactivityKeys: ORGANIZATION_KEYS }).pipe(
    notify(get, {
      success: () => "Organization restored.",
      errors: {
        OrganizationNotFoundError: (error) => error.message,
        OrganizationNotDeletedError: (error) => error.message,
        Forbidden: (error) => error.message,
      },
    }),
  ),
);
