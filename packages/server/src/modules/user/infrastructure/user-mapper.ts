import { UserId } from "@org/contracts/EntityIds";
import type { DbSchema } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import { type UserRole } from "../domain/user-role.js";
import { User } from "../domain/user.js";
import { Address } from "../domain/value-objects/address.js";

type Row = typeof DbSchema.usersTable.$inferSelect;
type InsertRow = typeof DbSchema.usersTable.$inferInsert;

export const toDomain = (row: Row): User =>
  new User({
    id: UserId.make(row.id),
    email: row.email,
    role: row.role as UserRole,
    address: new Address({
      country: row.country,
      street: row.street,
      postalCode: row.postalCode,
    }),
    createdAt: DateTime.unsafeMake(row.createdAt),
    updatedAt: DateTime.unsafeMake(row.updatedAt),
  });

export const toPersistence = (user: User): InsertRow => ({
  id: user.id,
  email: user.email,
  role: user.role,
  country: user.address.country,
  street: user.address.street,
  postalCode: user.address.postalCode,
  createdAt: DateTime.toDate(user.createdAt),
  updatedAt: DateTime.toDate(user.updatedAt),
});
