import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as pg from "pg";

// Mirrors packages/server/src/test-utils/test-database.ts. Duplicated rather
// than imported because @org/jobs must not depend on @org/server (different
// deployable, different runtime graph). When/if a third consumer needs this,
// promote it to a shared @org/test-utils package.

const rawUrl = process.env.DATABASE_URL_TEST;
export const TEST_DATABASE_URL: string | undefined =
  rawUrl !== undefined && rawUrl.length > 0 ? rawUrl : undefined;

export const hasTestDatabase = TEST_DATABASE_URL !== undefined;

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

let migrationsPromise: Promise<void> | undefined;

const doRunMigrations = async (): Promise<void> => {
  if (TEST_DATABASE_URL === undefined) return;
  assertTestDbName(TEST_DATABASE_URL);
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await pool.query(`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`);
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

export const truncate = (...tables: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    for (const table of tables) {
      yield* db.execute((client) =>
        client.query(sql.unsafe`TRUNCATE TABLE ${sql.identifier([table])} CASCADE`),
      );
    }
  }).pipe(Effect.orDie);
