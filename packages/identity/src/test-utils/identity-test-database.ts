import * as Effect from "effect/Effect";
import pg from "pg";

import { migrateIdentityDatabase } from "../auth/identity-migrations.js";

const IDENTITY_TABLES = [
  "oauthAccessToken",
  "oauthRefreshToken",
  "oauthConsent",
  "oauthClientResource",
  "oauthClientAssertion",
  "oauthClient",
  "oauthResource",
  "verification",
  "account",
  "session",
  "user",
];

// The identity database sits beside the app's test database, on the same server.
export const identityTestDatabaseUrl = (): string => {
  const appTestUrl = process.env.DATABASE_URL_TEST;
  if (appTestUrl === undefined || appTestUrl === "") {
    throw new Error("DATABASE_URL_TEST must be set to run the identity integration suite");
  }
  const url = new URL(appTestUrl);
  url.pathname = `${url.pathname}-identity`;
  return url.toString();
};

const databaseNameOf = (connectionString: string): string =>
  decodeURIComponent(new URL(connectionString).pathname.slice(1));

const ensureDatabaseExists = Effect.fn("ensureDatabaseExists")(function* (target: string) {
  const name = databaseNameOf(target);
  if (!name.includes("test")) {
    return yield* Effect.die(`Refusing to prepare "${name}": its name must contain "test"`);
  }
  const server = new URL(target);
  server.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: server.toString() });
  yield* Effect.acquireRelease(
    Effect.promise(() => admin.connect()),
    () => Effect.promise(() => admin.end()),
  );
  const existing = yield* Effect.promise(() =>
    admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]),
  );
  if (existing.rowCount === 0) {
    yield* Effect.promise(() => admin.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`));
  }
});

export const prepareIdentityTestDatabase = Effect.gen(function* () {
  const target = identityTestDatabaseUrl();
  yield* ensureDatabaseExists(target);
  const pool = yield* Effect.acquireRelease(
    Effect.sync(() => new pg.Pool({ connectionString: target, max: 1 })),
    (p) => Effect.promise(() => p.end()),
  );
  yield* migrateIdentityDatabase(pool);
}).pipe(Effect.scoped);

export const truncateIdentityTables = (pool: pg.Pool): Promise<unknown> =>
  pool.query(
    `TRUNCATE ${IDENTITY_TABLES.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
