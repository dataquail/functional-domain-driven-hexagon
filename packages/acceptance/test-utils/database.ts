import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { MEMBER_EMAIL } from "./member-credentials";

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

// Kept in sync with packages/database/migrations/V00*__create_schema_*.sql
// (ADR-0020). Each module owns its own schema.
const MODULE_SCHEMAS = [
  "user",
  "todos",
  "wallet",
  "auth",
  "platform",
  "organization",
  "billing",
] as const;

export const runMigrations = async (databaseUrl: string): Promise<void> => {
  assertTestDbName(databaseUrl);
  const pool = new pg.Pool({ connectionString: databaseUrl });
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

const splitQualified = (qualified: string): readonly [string, string] => {
  const [schema, table, ...rest] = qualified.split(".");
  if (schema === undefined || table === undefined || rest.length > 0) {
    throw new Error(
      `[acceptance/test-utils] expected "schema.table", got "${qualified}". Acceptance specs must qualify table names with their owning module schema.`,
    );
  }
  return [schema, table];
};

// Truncate is auth-aware: when a spec asks to clear `user.users`, we DELETE
// non-system rows instead of TRUNCATE'ing — a preserved user's session and
// `auth_identities` row would otherwise CASCADE-delete and break the
// storageState cookie for the next spec. We preserve BOTH the admin
// (ZITADEL_ADMIN_EMAIL, seeded by admin-seed.ts) and the regular member
// (MEMBER_EMAIL, JIT-provisioned at member-setup login) so an org-scoped
// spec's member session survives a user-table reset by another spec
// regardless of run order.
export const truncate = async (
  databaseUrl: string,
  tables: ReadonlyArray<string>,
): Promise<void> => {
  assertTestDbName(databaseUrl);
  if (tables.length === 0) return;
  const adminEmail = process.env.ZITADEL_ADMIN_EMAIL ?? "admin@example.com";
  const preservedEmails = [adminEmail, MEMBER_EMAIL];
  const qualified = tables.map(splitQualified);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const usersEntry = qualified.find(([s, t]) => s === "user" && t === "users");
    if (usersEntry !== undefined) {
      await pool.query(`DELETE FROM "user".users WHERE email <> ALL($1::text[])`, [
        preservedEmails,
      ]);
      const others = qualified.filter(([s, t]) => !(s === "user" && t === "users"));
      if (others.length > 0) {
        const list = others.map(([s, t]) => `"${s}"."${t}"`).join(", ");
        await pool.query(`TRUNCATE TABLE ${list} CASCADE`);
      }
      return;
    }
    const list = qualified.map(([s, t]) => `"${s}"."${t}"`).join(", ");
    await pool.query(`TRUNCATE TABLE ${list} CASCADE`);
  } finally {
    await pool.end();
  }
};
