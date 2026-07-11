import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { MembershipRoot } from "@/modules/organization/domain/membership/membership.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

type Row = RowSchemas.MembershipRow;

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
