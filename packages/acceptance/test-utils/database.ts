import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Test-database utilities for the acceptance workspace. Mirrors the server's
// `test-utils/test-database.ts` approach: drop+replay migrations from the
// shared `packages/database/migrations/` directory, and refuse to operate
// on any DB whose name doesn't contain `test`.

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "../../database/migrations");

const assertTestDbName = (url: string): string => {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.toLowerCase().includes("test")) {
    throw new Error(
      `[acceptance/test-utils] refusing to operate on '${name}' — DATABASE_URL_TEST name must contain 'test'`,
    );
  }
  return url;
};

export const runMigrations = async (databaseUrl: string): Promise<void> => {
  assertTestDbName(databaseUrl);
  const pool = new pg.Pool({ connectionString: databaseUrl });
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

export const truncate = async (
  databaseUrl: string,
  tables: ReadonlyArray<string>,
): Promise<void> => {
  assertTestDbName(databaseUrl);
  if (tables.length === 0) return;
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const list = tables.map((t) => `"${t}"`).join(", ");
    await pool.query(`TRUNCATE TABLE ${list} CASCADE`);
  } finally {
    await pool.end();
  }
};
