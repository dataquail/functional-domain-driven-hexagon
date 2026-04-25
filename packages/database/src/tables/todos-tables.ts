import * as pg from "drizzle-orm/pg-core";
import * as DateTime from "effect/DateTime";
import { constant } from "effect/Function";

const utcNow = constant(DateTime.toDateUtc(DateTime.unsafeNow()));

export const todosTable = pg.pgTable("todos", {
  id: pg.uuid("id").primaryKey().defaultRandom(),
  title: pg.text("title").notNull(),
  completed: pg.boolean("completed").notNull().default(false),
  createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: pg
    .timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(utcNow),
});
