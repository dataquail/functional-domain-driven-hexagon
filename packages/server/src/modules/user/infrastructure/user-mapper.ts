import { UserId } from "@/platform/ids/user-id.js";
import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import { type UserRole } from "../domain/user-role.js";
import { User } from "../domain/user.aggregate.js";
import { Address } from "../domain/value-objects/address.js";

type Row = RowSchemas.UserRow;

export const toDomain = (row: Row): User =>
  new User({
    id: UserId.make(row.id),
    email: row.email,
    role: row.role as UserRole,
    address: new Address({
      country: row.country,
      street: row.street,
      postalCode: row.postal_code,
    }),
    createdAt: DateTime.unsafeMake(row.created_at),
    updatedAt: DateTime.unsafeMake(row.updated_at),
  });

export type PersistenceRow = {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly country: string;
  readonly street: string;
  readonly postal_code: string;
  readonly created_at: Date;
  readonly updated_at: Date;
};

export const toPersistence = (user: User): PersistenceRow => ({
  id: user.id,
  email: user.email,
  role: user.role,
  country: user.address.country,
  street: user.address.street,
  postal_code: user.address.postalCode,
  created_at: DateTime.toDate(user.createdAt),
  updated_at: DateTime.toDate(user.updatedAt),
});
