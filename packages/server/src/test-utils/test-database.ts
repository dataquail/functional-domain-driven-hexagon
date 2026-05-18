import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as pg from "pg";

const rawUrl = process.env.DATABASE_URL_TEST;
export const TEST_DATABASE_URL: string | undefined =
  rawUrl !== undefined && rawUrl.length > 0 ? rawUrl : undefined;

export const hasTestDatabase = TEST_DATABASE_URL !== undefined;

// Never point a truncate/migrate at a DB that isn't explicitly a test DB.
const assertTestDbName = (url: string): string => {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.toLowerCase().includes("test")) {
    throw new Error(
      `[test-database] refusing to operate on '${name}' — DATABASE_URL_TEST name must contain 'test'`,
    );
  }
  return url;
};

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../database/migrations",
);

export const TestDatabaseLive =
  TEST_DATABASE_URL !== undefined
    ? Database.layer({
        url: Redacted.make(assertTestDbName(TEST_DATABASE_URL)),
        ssl: false,
      })
    : (Layer.die(new Error("DATABASE_URL_TEST is not set")) as ReturnType<typeof Database.layer>);

// Tests always migrate from scratch, so we drop every module schema and replay
// the Flyway-named migration files in order. This intentionally avoids
// Flyway's checksum/history semantics — those matter for production drift,
// not for a per-run test database. Memoized so concurrent test files that
// each call runMigrations in beforeAll don't race the destructive reset.
let migrationsPromise: Promise<void> | undefined;

// Kept in sync with packages/database/migrations/V00*__create_schema_*.sql.
// Each module owns its own schema (ADR-0021).
const MODULE_SCHEMAS = ["user", "todos", "wallet", "auth"] as const;

const doRunMigrations = async (): Promise<void> => {
  if (TEST_DATABASE_URL === undefined) return;
  assertTestDbName(TEST_DATABASE_URL);
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  try {
    const dropList = MODULE_SCHEMAS.map((s) => `"${s}"`).join(", ");
    await pool.query(`DROP SCHEMA IF EXISTS ${dropList} CASCADE;`);
    const entries = await fs.readdir(migrationsFolder);
    const sqlFiles = entries
      .filter((f) => /^V\d+__.*\.sql$/.test(f))
      .sort((a, b) => {
        const na = Number(/^V(\d+)__/.exec(a)?.[1] ?? 0);
        const nb = Number(/^V(\d+)__/.exec(b)?.[1] ?? 0);
        return na - nb;
      });
    for (const file of sqlFiles) {
      const body = await fs.readFile(path.join(migrationsFolder, file), "utf8");
      await pool.query(body);
    }
  } finally {
    await pool.end();
  }
};

export const runMigrations = (): Promise<void> => {
  migrationsPromise ??= doRunMigrations();
  return migrationsPromise;
};

// Each table reference must be schema-qualified ("schema.table") so we can
// build a "schema"."table" identifier. Cross-schema TRUNCATE CASCADE remains
// the test seam — application code never crosses schemas (enforced by
// no-cross-schema-slonik-access).
const splitQualified = (qualified: string): readonly [string, string] => {
  const [schema, table, ...rest] = qualified.split(".");
  if (schema === undefined || table === undefined || rest.length > 0) {
    throw new Error(
      `[truncate] expected "schema.table", got "${qualified}". Tests must qualify table names with their owning module schema.`,
    );
  }
  return [schema, table];
};

export const truncate = (...tables: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    for (const qualified of tables) {
      const [schema, table] = splitQualified(qualified);
      yield* db.execute((client) =>
        client.query(sql.unsafe`TRUNCATE TABLE ${sql.identifier([schema, table])} CASCADE`),
      );
    }
  }).pipe(Effect.orDie);
