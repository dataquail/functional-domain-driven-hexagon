import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { config as dotenv } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as Database from "../Database.js";
import { MODULE_SCHEMAS } from "../migrations.js";

dotenv({
  path: "../../.env",
});

const TableRow = Schema.Struct({
  table_schema: Schema.String,
  table_name: Schema.String,
});

const resetDatabase = Effect.gen(function* () {
  const sql = yield* Database.Database;

  yield* sql.withTransaction(
    Effect.gen(function* () {
      for (const schema of MODULE_SCHEMAS) {
        yield* sql`DROP SCHEMA IF EXISTS ${sql(schema)} CASCADE`.pipe(Database.exec);
        yield* Effect.log(`Dropped schema: ${schema}`);
      }

      // Anything the module schemas did not carry away — the migration history and
      // any stray table a hand-run script left in `public`.
      const tables = yield* sql`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `.pipe(Database.rows(TableRow));

      for (const table of tables) {
        yield* sql`
          DROP TABLE IF EXISTS ${sql(`${table.table_schema}.${table.table_name}`)} CASCADE
        `.pipe(Database.exec);
        yield* Effect.log(`Dropped table: ${table.table_schema}.${table.table_name}`);
      }

      yield* Effect.log("Database reset successfully");
    }),
  );
}).pipe(
  Effect.provide(
    Layer.unwrap(
      Effect.gen(function* () {
        const url = yield* Config.redacted("DATABASE_URL");
        return Database.layer({ url, ssl: false });
      }),
    ),
  ),
);

NodeRuntime.runMain(resetDatabase);
