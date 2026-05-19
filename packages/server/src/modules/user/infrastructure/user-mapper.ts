import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { UserId } from "@/platform/ids/user-id.js";

import { User } from "../domain/user.aggregate.js";
import { Address } from "../domain/value-objects/address.js";

type Row = RowSchemas.UserRow;

export const toDomain = (row: Row): User =>
  new User({
    id: UserId.make(row.id),
    email: row.email,
    isSuperAdmin: row.is_super_admin,
    address: new Address({
      country: row.country,
      street: row.street,
      postalCode: row.postal_code,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export type PersistenceRow = {
  readonly id: string;
  readonly email: string;
  readonly is_super_admin: boolean;
  readonly country: string;
  readonly street: string;
  readonly postal_code: string;
  readonly created_at: Date;
  readonly updated_at: Date;
};

export const toPersistence = (user: User): PersistenceRow => ({
  id: user.id,
  email: user.email,
  is_super_admin: user.isSuperAdmin,
  country: user.address.country,
  street: user.address.street,
  postal_code: user.address.postalCode,
  created_at: DateTime.toDate(user.createdAt),
  updated_at: DateTime.toDate(user.updatedAt),
});
