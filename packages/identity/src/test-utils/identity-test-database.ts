import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import pg from "pg";

import { migrateIdentityDatabase } from "../auth/identity-migrations.ts";

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
export const identityTestDatabaseUrl = Config.NonEmptyString("DATABASE_URL_TEST").pipe(
  Effect.map((appTestUrl) => {
    const url = new URL(appTestUrl);
    url.pathname = `${url.pathname}-identity`;

    return url.toString();
  }),
  Effect.orDie,
);

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

const pool = (max: number) =>
  Effect.acquireRelease(
    Effect.map(identityTestDatabaseUrl, (url) => new pg.Pool({ connectionString: url, max })),
    (opened) => Effect.promise(() => opened.end()),
  );

export const prepareIdentityTestDatabase = Effect.gen(function* () {
  const target = yield* identityTestDatabaseUrl;
  yield* ensureDatabaseExists(target);

  yield* migrateIdentityDatabase(yield* pool(1));
}).pipe(Effect.scoped);

export const truncateIdentityTables = (database: pg.Pool): Effect.Effect<void> =>
  Effect.promise(() =>
    database.query(
      `TRUNCATE ${IDENTITY_TABLES.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`,
    ),
  ).pipe(Effect.asVoid);

// One pool for a describe block, closed when the block's layer is released.
export class IdentityTestDatabase extends Context.Service<IdentityTestDatabase, pg.Pool>()(
  "IdentityTestDatabase",
) {
  public static readonly layer = Layer.effect(IdentityTestDatabase, pool(2));
}
