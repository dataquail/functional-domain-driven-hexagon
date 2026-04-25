import * as pg from "drizzle-orm/pg-core";
import * as DateTime from "effect/DateTime";
import { constant } from "effect/Function";
import { usersTable } from "./users-table.js";

const utcNow = constant(DateTime.toDateUtc(DateTime.unsafeNow()));

export const walletsTable = pg.pgTable("wallets", {
  id: pg.uuid("id").primaryKey().defaultRandom(),
  userId: pg
    .uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  balance: pg.bigint("balance", { mode: "number" }).notNull().default(0),
  createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: pg
    .timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(utcNow),
});
