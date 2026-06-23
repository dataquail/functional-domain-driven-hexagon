// View-model for the super-admin OrgsList. Computes per-row display
// state from the raw paginated response: which rows are deletable
// (still active) vs. restorable (soft-deleted), and the formatted
// timestamps the table renders. Same shape as the existing user-list
// pagination view-model.

import type { OrganizationContract } from "@org/contracts/api/Contracts";

export type OrgRowView = {
  readonly id: OrganizationContract.Organization["id"];
  readonly name: string;
  readonly createdAtLabel: string;
  readonly isDeleted: boolean;
  readonly deletedAtLabel: string | null;
};

export type OrgsListView = {
  readonly rows: ReadonlyArray<OrgRowView>;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
  readonly isEmpty: boolean;
};

// TanStack Query's dehydrate → JSON → hydrate round-trip turns
// `Schema.DateTimeUtc` fields into their toJSON() form (an ISO string)
// — the Schema decode does NOT re-run on hydration. So on the client
// the runtime shape of `createdAt`/`deletedAt` is `string`, not
// `DateTime.Utc`, despite the contract type. Treat anything we get
// as a string-or-date-like and slice the ISO prefix.
const formatDate = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "epochMillis" in value) {
    const millis = value.epochMillis;
    if (typeof millis === "number" && Number.isFinite(millis)) {
      return new Date(millis).toISOString().slice(0, 10);
    }
  }
  return null;
};

export const computeOrgsListView = (input: {
  readonly response: OrganizationContract.PaginatedOrganizations;
}): OrgsListView => {
  const { organizations, page, pageSize, total } = input.response;
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const rows = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    createdAtLabel: formatDate(org.createdAt) ?? "",
    isDeleted: org.deletedAt !== null,
    deletedAtLabel: formatDate(org.deletedAt),
  }));

  return {
    rows,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
    isEmpty: rows.length === 0,
  };
};
