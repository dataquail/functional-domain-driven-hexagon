import { Database } from "@org/database/index";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
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
  "../../../database/drizzle",
);

export const TestDatabaseLive =
  TEST_DATABASE_URL !== undefined
    ? Database.layer({
        url: Redacted.make(assertTestDbName(TEST_DATABASE_URL)),
        ssl: false,
      })
    : (Layer.die(new Error("DATABASE_URL_TEST is not set")) as ReturnType<typeof Database.layer>);

export const runMigrations = async (): Promise<void> => {
  if (TEST_DATABASE_URL === undefined) return;
  assertTestDbName(TEST_DATABASE_URL);
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
};

export const truncate = (...tables: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    for (const table of tables) {
      yield* db.execute((client) => client.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`)));
    }
  }).pipe(Effect.orDie);
