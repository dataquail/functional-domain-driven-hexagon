import { deepStrictEqual } from "node:assert";

import { Database, MODULE_SCHEMAS } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { describeIntegration } from "@/test-utils/server-test-runtime";
import { migrateTestDatabase, TestDatabaseLive } from "@/test-utils/test-database";

const SchemaRow = Schema.Struct({ schema_name: Schema.String });

const CountRow = Schema.Struct({ count: Schema.Finite });

describeIntegration("migrations", { layer: TestDatabaseLive, tables: [] }, (it) => {
  it.effect("replay every module schema onto an emptied database", () =>
    Effect.gen(function* () {
      yield* migrateTestDatabase;
      const sql = yield* Database.Database;

      const schemas = yield* sql`
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name = ANY(${Database.textArray([...MODULE_SCHEMAS])}::text[])
        ORDER BY schema_name
      `.pipe(Database.rows(SchemaRow), Effect.orDie);

      deepStrictEqual(
        schemas.map((row) => row.schema_name),
        [...MODULE_SCHEMAS].sort(),
      );

      const todos = yield* sql`SELECT count(*)::int AS count FROM todos.todos`.pipe(
        Database.row(CountRow),
        Effect.orDie,
      );

      deepStrictEqual(todos.count, 0);
    }),
  );
});
