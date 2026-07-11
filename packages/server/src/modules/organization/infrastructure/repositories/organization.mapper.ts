import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { OrganizationRoot } from "@/modules/organization/domain/organization/organization.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

type Row = RowSchemas.OrganizationRow;

export const toDomain = (row: Row): OrganizationRoot =>
  new OrganizationRoot({
    id: OrganizationId.make(row.id),
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });

export type PersistenceRow = {
  readonly id: string;
  readonly name: string;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly deleted_at: Date | null;
};

export const toPersistence = (organization: OrganizationRoot): PersistenceRow => ({
  id: organization.id,
  name: organization.name,
  created_at: DateTime.toDate(organization.createdAt),
  updated_at: DateTime.toDate(organization.updatedAt),
  deleted_at: organization.deletedAt === null ? null : DateTime.toDate(organization.deletedAt),
});
