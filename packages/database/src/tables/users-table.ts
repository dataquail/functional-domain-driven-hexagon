import * as pg from "drizzle-orm/pg-core";
import * as DateTime from "effect/DateTime";
import { constant } from "effect/Function";

const utcNow = constant(DateTime.toDateUtc(DateTime.unsafeNow()));

export const usersTable = pg.pgTable("users", {
  id: pg.uuid("id").primaryKey().defaultRandom(),
  email: pg.varchar("email", { length: 255 }).notNull().unique(),
  role: pg.varchar("role", { length: 32 }).notNull().default("guest"),
  country: pg.varchar("country", { length: 50 }).notNull(),
  street: pg.varchar("street", { length: 50 }).notNull(),
  postalCode: pg.varchar("postal_code", { length: 10 }).notNull(),
  createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: pg
    .timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(utcNow),
});
