import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import * as PgMigrator from "@effect/sql-pg/PgMigrator";
import * as Effect from "effect/Effect";
import { FileSystem } from "effect/FileSystem";
import type { Path } from "effect/Path";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import * as Migrator from "effect/unstable/sql/Migrator";
import { SqlClient } from "effect/unstable/sql/SqlClient";
import type { SqlError } from "effect/unstable/sql/SqlError";

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

// Resolved by walking up rather than by a fixed relative path: this module is
// consumed both as TypeScript source (vitest, tsx) and as built ESM, which sit at
// different depths under the package root.
const findMigrationsDirectory = (): string => {
  let directory = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth++) {
    const candidate = path.join(directory, "migrations");
    if (fs.existsSync(path.join(candidate, "V001__create_schema_user.sql"))) return candidate;
    directory = path.dirname(directory);
  }
  throw new Error("[@org/database] could not locate the migrations directory");
};

export const MIGRATIONS_DIRECTORY: string = findMigrationsDirectory();

const FLYWAY_FILENAME = /^V(\d+)__(.+)\.sql$/;

// ADR-0011 keeps migrations as forward-only `.sql` files under Flyway naming. The
// Migrator's own loaders only understand `<id>_<name>.{js,ts}`, so this adapts the
// naming rather than converting 22 files to TypeScript. Bodies are read here, while
// FileSystem is in scope, so a migration itself requires nothing but SqlClient.
export const fromSqlDirectory = (directory: string): Migrator.Loader<FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    const failed = (cause: unknown, message: string) =>
      new Migrator.MigrationError({ kind: "Failed", cause, message });

    const entries = yield* Effect.mapError(fs.readDirectory(directory), (cause) =>
      failed(cause, `Failed to read migrations directory ${directory}`),
    );

    const parsed = entries
      .flatMap((entry) => {
        const [, id, name] = FLYWAY_FILENAME.exec(entry) ?? [];
        return id === undefined || name === undefined ? [] : [{ id: Number(id), name, entry }];
      })
      .sort((left, right) => left.id - right.id);

    return yield* Effect.forEach(parsed, ({ entry, id, name }) =>
      Effect.map(
        Effect.mapError(fs.readFileString(`${directory}/${entry}`), (cause) =>
          failed(cause, `Failed to read migration ${entry}`),
        ),
        (body): Migrator.ResolvedMigration => [
          id,
          name,
          Effect.succeed(Effect.flatMap(SqlClient, (sql) => sql.unsafe(body))),
        ],
      ),
    );
  });

export const runMigrations = (
  config: Config,
  directory: string,
): Effect.Effect<
  ReadonlyArray<readonly [id: number, name: string]>,
  Migrator.MigrationError | SqlError,
  ChildProcessSpawner | FileSystem | Path
> =>
  PgMigrator.run({ loader: fromSqlDirectory(directory) }).pipe(Effect.provide(driverLayer(config)));

// Test replay: every run starts from empty module schemas, so there is no checksum
// or history to reconcile — dropping the history table alongside them is what makes
// the Migrator re-apply everything.
export const resetAndMigrate = (config: Config, directory: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    for (const schema of MODULE_SCHEMAS) {
      yield* sql`DROP SCHEMA IF EXISTS ${sql(schema)} CASCADE`;
    }
    yield* sql`DROP TABLE IF EXISTS effect_sql_migrations`;
  }).pipe(Effect.provide(driverLayer(config)), Effect.andThen(runMigrations(config, directory)));
