import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { config as dotenv } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { sql } from "slonik";
import * as Database from "../Database.js";

dotenv({
  path: "../../.env",
});

const TypeRow = Schema.standardSchemaV1(Schema.Struct({ typname: Schema.String }));
const TableRow = Schema.standardSchemaV1(Schema.Struct({ table_name: Schema.String }));

const resetDatabase = Effect.gen(function* () {
  const db = yield* Database.Database;

  yield* db.transaction(
    Effect.fnUntraced(function* (tx) {
      const types = yield* tx((client) =>
        client.any(sql.type(TypeRow)`
          SELECT typname
          FROM pg_type
          WHERE typtype = 'e'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        `),
      );

      for (const type of types) {
        yield* tx((client) =>
          client.query(sql.unsafe`DROP TYPE IF EXISTS ${sql.identifier([type.typname])} CASCADE`),
        );
        yield* Effect.log(`Dropped type: ${type.typname}`);
      }

      const tables = yield* tx((client) =>
        client.any(sql.type(TableRow)`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        `),
      );

      for (const table of tables) {
        yield* tx((client) =>
          client.query(
            sql.unsafe`DROP TABLE IF EXISTS ${sql.identifier([table.table_name])} CASCADE`,
          ),
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
