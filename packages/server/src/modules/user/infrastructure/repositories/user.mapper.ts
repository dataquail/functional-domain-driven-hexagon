import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { type ColumnMap } from "@/globals/infrastructure/database/criteria-to-sql.js";
import { UserRoot } from "@/modules/user/domain/user/user.root.js";
import { AddressValueObject } from "@/modules/user/domain/user/value-objects/address.value-object.js";

type Row = RowSchemas.UserRow;

// Resolves the specification field names the live repository filters on to
// physical columns of "user".users. Only filterable scalar fields need an
// entry; `satisfies` keeps the keys honest against the root.
export const columns = {
  id: "id",
  email: "email",
} as const satisfies Partial<Record<keyof UserRoot, string>> & ColumnMap;

export const toDomain = (row: Row): UserRoot =>
  new UserRoot({
    id: UserId.make(row.id),
    email: row.email,
    // The three address columns move together (NOT NULL was dropped for JIT
    // provisioning). A row has a full address or none.
    address: Option.all({
      country: Option.fromNullOr(row.country),
      street: Option.fromNullOr(row.street),
      postalCode: Option.fromNullOr(row.postal_code),
    }).pipe(Option.map((fields) => new AddressValueObject(fields))),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export type PersistenceRow = typeof RowSchemas.UserRow.Encoded;

const addressColumn = (user: UserRoot, field: keyof AddressValueObject) =>
  Option.getOrNull(Option.map(user.address, (address) => address[field]));

export const toPersistence = (user: UserRoot): PersistenceRow => ({
  id: user.id,
  email: user.email,
  country: addressColumn(user, "country"),
  street: addressColumn(user, "street"),
  postal_code: addressColumn(user, "postalCode"),
  created_at: DateTime.toDate(user.createdAt),
  updated_at: DateTime.toDate(user.updatedAt),
});
