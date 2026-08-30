import * as PgMigrator from "@effect/sql-pg/PgMigrator";
import * as Effect from "effect/Effect";
import type { FileSystem } from "effect/FileSystem";
import type { Path } from "effect/Path";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import * as Migrator from "effect/unstable/sql/Migrator";
import { SqlClient } from "effect/unstable/sql/SqlClient";
import type { SqlError } from "effect/unstable/sql/SqlError";

import { migrations } from "./migrations/index.js";
import { type Config, driverLayer } from "./pg-driver.js";

// ADR-0020: each module owns a Postgres schema named after its folder, plus the
// shared `platform` schema. Adding a module means a migration and an entry here.
export const MODULE_SCHEMAS = [
  "user",
  "todos",
  "wallet",
  "auth",
  "platform",
  "organization",
  "billing",
] as const;

export const migrationsLoader: Migrator.Loader = Migrator.fromRecord(migrations);

export const runMigrations = (
  config: Config,
): Effect.Effect<
  ReadonlyArray<readonly [id: number, name: string]>,
  Migrator.MigrationError | SqlError,
  ChildProcessSpawner | FileSystem | Path
> => PgMigrator.run({ loader: migrationsLoader }).pipe(Effect.provide(driverLayer(config)));

// Test replay: every run starts from empty module schemas, so there is no
// checksum or history to reconcile — dropping the history table alongside them is
// what makes the migrator re-apply everything.
export const resetAndMigrate = (config: Config) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    for (const schema of MODULE_SCHEMAS) {
      yield* sql`DROP SCHEMA IF EXISTS ${sql(schema)} CASCADE`;
    }
    yield* sql`DROP TABLE IF EXISTS effect_sql_migrations`;
  }).pipe(Effect.provide(driverLayer(config)), Effect.andThen(runMigrations(config)));
