import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { type ColumnMap } from "@/globals/infrastructure/database/criteria-to-sql";
import { OrganizationRoot } from "@/modules/organization/domain/organization/organization.root";

type Row = RowSchemas.OrganizationRow;

// Resolves the specification field names the live repository filters on to
// physical columns of "organization".organizations. Only filterable scalar
// fields need an entry; `satisfies` keeps the keys honest against the root.
export const columns = {
  id: "id",
  deletedAt: "deleted_at",
} as const satisfies Partial<Record<keyof OrganizationRoot, string>> & ColumnMap;

export const toDomain = (row: Row): OrganizationRoot =>
  new OrganizationRoot({
    id: OrganizationId.make(row.id),
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: Option.fromNullOr(row.deleted_at),
  });

export const toPersistence = (organization: OrganizationRoot) => ({
  id: organization.id,
  name: organization.name,
  created_at: DateTime.toDate(organization.createdAt),
  updated_at: DateTime.toDate(organization.updatedAt),
  deleted_at: Option.getOrNull(Option.map(organization.deletedAt, DateTime.toDate)),
});
