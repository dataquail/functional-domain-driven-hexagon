import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { MembershipRoot } from "@/modules/organization/domain/membership/membership.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { type ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

type Row = RowSchemas.MembershipRow;

// Resolves the specification field names the live repository filters on to
// physical columns of "organization".memberships. Only filterable scalar
// fields need an entry; `satisfies` keeps the keys honest against the root.
export const columns = {
  userId: "user_id",
  organizationId: "organization_id",
} as const satisfies Partial<Record<keyof MembershipRoot, string>> & ColumnMap;

export const toDomain = (row: Row): MembershipRoot =>
  new MembershipRoot({
    userId: UserId.make(row.user_id),
    organizationId: OrganizationId.make(row.organization_id),
    createdAt: row.created_at,
  });

export type PersistenceRow = {
  readonly user_id: string;
  readonly organization_id: string;
  readonly created_at: Date;
};

export const toPersistence = (membership: MembershipRoot): PersistenceRow => ({
  user_id: membership.userId,
  organization_id: membership.organizationId,
  created_at: DateTime.toDate(membership.createdAt),
});
