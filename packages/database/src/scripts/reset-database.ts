import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { config as dotenv } from "dotenv";
import { sql } from "drizzle-orm";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Database from "../Database.js";

dotenv({
  path: "../../.env",
});

const resetDatabase = Effect.gen(function* () {
  const db = yield* Database.Database;

  yield* db.transaction(
    Effect.fnUntraced(function* (tx) {
      const typesResult = yield* tx((client) =>
        client.execute<{ typname: string }>(sql`
      SELECT typname 
      FROM pg_type 
      WHERE typtype = 'e' 
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    `),
      );

      for (const type of typesResult.rows) {
        yield* tx((client) =>
          client.execute(sql`DROP TYPE IF EXISTS "${sql.raw(type.typname)}" CASCADE;`),
        );
        yield* Effect.log(`Dropped type: ${type.typname}`);
      }

      const tablesResult = yield* tx((client) =>
        client.execute<{ table_name: string }>(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    `),
      );

      for (const table of tablesResult.rows) {
        yield* tx((client) =>
          client.execute(sql`DROP TABLE IF EXISTS "${sql.raw(table.table_name)}" CASCADE;`),
        );
        yield* Effect.log(`Dropped table: ${table.table_name}`);
      }

      yield* Effect.log("Database reset successfully: all tables and types dropped");
    }),
  );
}).pipe(
  Effect.provide(
    Layer.unwrapEffect(
      Effect.gen(function* () {
        const url = yield* Config.redacted("DATABASE_URL");
        return Database.layer({
          url,
          ssl: false,
        });
      }),
    ),
  ),
);

NodeRuntime.runMain(resetDatabase);
