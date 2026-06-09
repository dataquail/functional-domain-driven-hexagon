// View-model for the admin OrgMembersList. Maps the contract's member
// rows into the row shape the leaf renders, plus a formatted joined-at
// label. See the org-list view-model's `formatDate` comment for why
// the formatter is defensive about the DateTime shape — TanStack
// Query's dehydrate strips DateTime.Utc instances down to ISO strings,
// so the client-side runtime value can be a string, a Date, or a
// DateTime-like.

import type { OrganizationContract } from "@org/contracts/api/Contracts";
import type { UserId } from "@org/contracts/EntityIds";

export type MemberRowView = {
  readonly userId: UserId;
  readonly email: string;
  readonly joinedAtLabel: string;
};

export type OrgMembersListView = {
  readonly rows: ReadonlyArray<MemberRowView>;
  readonly isEmpty: boolean;
};

const formatDate = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "epochMillis" in value) {
    const millis = value.epochMillis;
    if (typeof millis === "number" && Number.isFinite(millis)) {
      return new Date(millis).toISOString().slice(0, 10);
    }
  }
  return "";
};

export const computeOrgMembersListView = (
  response: OrganizationContract.OrganizationMembersResponse,
): OrgMembersListView => {
  const rows = response.members.map((m) => ({
    userId: m.userId,
    email: m.email,
    joinedAtLabel: formatDate(m.joinedAt),
  }));
  return { rows, isEmpty: rows.length === 0 };
};
