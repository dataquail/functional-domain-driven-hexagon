import * as NodeServices from "@effect/platform-node/NodeServices";
import { Database, resetAndMigrate } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

const rawUrl = process.env.DATABASE_URL_TEST;
export const TEST_DATABASE_URL: string | undefined =
  rawUrl !== undefined && rawUrl.length > 0 ? rawUrl : undefined;

// The integration suite must fail — never skip — when it has no database to
// talk to. Called from the integration global-setup; throws a clear error if
// `DATABASE_URL_TEST` is unset so the whole run aborts before any test loads.
export const assertTestDatabaseConfigured = (): void => {
  if (TEST_DATABASE_URL === undefined) {
    throw new Error(
      "[test-database] integration tests require DATABASE_URL_TEST to be set. " +
        "Start the test database and export DATABASE_URL_TEST (its name must contain 'test').",
    );
  }
};

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

export const TestDatabaseLive =
  TEST_DATABASE_URL !== undefined
    ? Database.layer({
        url: Redacted.make(assertTestDbName(TEST_DATABASE_URL)),
        ssl: false,
      })
    : (Layer.effect(
        Database.Database,
        Effect.die(new Error("DATABASE_URL_TEST is not set")),
      ) as ReturnType<typeof Database.layer>);

// Tests always migrate from scratch: every module schema is dropped and the
// migrations replayed. Memoized so concurrent test files that each call
// runMigrations in beforeAll don't race the destructive reset.
let migrationsPromise: Promise<void> | undefined;

const doRunMigrations = async (): Promise<void> => {
  if (TEST_DATABASE_URL === undefined) return;
  const url = Redacted.make(assertTestDbName(TEST_DATABASE_URL));
  await Effect.runPromise(
    resetAndMigrate({ url, ssl: false }).pipe(
      Effect.asVoid,
      Effect.provide(NodeServices.layer),
      Effect.orDie,
    ),
  );
};

export const runMigrations = (): Promise<void> => {
  migrationsPromise ??= doRunMigrations();
  return migrationsPromise;
};

// Each table reference must be schema-qualified ("schema.table"). Cross-schema
// TRUNCATE CASCADE remains the test seam — application code never crosses
// schemas (enforced by the cross-schema lint rule).
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
    const sql = yield* Database.Database;
    for (const qualified of tables) {
      const [schema, table] = splitQualified(qualified);
      yield* sql`TRUNCATE TABLE ${sql(`${schema}.${table}`)} CASCADE`;
    }
  }).pipe(Effect.orDie);
