import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { Membership } from "../domain/membership.aggregate.js";

type Row = RowSchemas.MembershipRow;

export const toDomain = (row: Row): Membership =>
  new Membership({
    userId: UserId.make(row.user_id),
    organizationId: OrganizationId.make(row.organization_id),
    createdAt: row.created_at,
  });

export type PersistenceRow = {
  readonly user_id: string;
  readonly organization_id: string;
  readonly created_at: Date;
};

export const toPersistence = (membership: Membership): PersistenceRow => ({
  user_id: membership.userId,
  organization_id: membership.organizationId,
  created_at: DateTime.toDate(membership.createdAt),
});
