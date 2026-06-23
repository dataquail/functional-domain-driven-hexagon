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
    // The three address columns move together (NOT NULL was dropped for JIT
    // provisioning). A row has a full address or none.
    address:
      row.country !== null && row.street !== null && row.postal_code !== null
        ? new Address({
            country: row.country,
            street: row.street,
            postalCode: row.postal_code,
          })
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export type PersistenceRow = {
  readonly id: string;
  readonly email: string;
  readonly country: string | null;
  readonly street: string | null;
  readonly postal_code: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
};

export const toPersistence = (user: User): PersistenceRow => ({
  id: user.id,
  email: user.email,
  country: user.address?.country ?? null,
  street: user.address?.street ?? null,
  postal_code: user.address?.postalCode ?? null,
  created_at: DateTime.toDate(user.createdAt),
  updated_at: DateTime.toDate(user.updatedAt),
});
