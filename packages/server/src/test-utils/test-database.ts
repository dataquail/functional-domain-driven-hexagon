import * as NodeServices from "@effect/platform-node/NodeServices";
import { Database, resetAndMigrate } from "@org/database/index";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

class TestDatabaseRefused extends Schema.TaggedError<
  TestDatabaseRefused,
  { readonly brand: "TestDatabaseRefused" }
>()("TestDatabaseRefused", {
  reason: Schema.String,
}) {}

const databaseName = (url: Redacted.Redacted<string>) =>
  new URL(Redacted.value(url)).pathname.replace(/^\//, "");

// Never point a truncate/migrate at a DB that isn't explicitly a test DB.
const refuseNonTestDatabase = (url: Redacted.Redacted<string>) =>
  Effect.succeed(url).pipe(
    Effect.filterOrFail(
      () => databaseName(url).toLowerCase().includes("test"),
      () =>
        new TestDatabaseRefused({
          reason: `refusing to operate on '${databaseName(url)}' — DATABASE_URL_TEST name must contain 'test'`,
        }),
    ),
    Effect.orDie,
  );

// Read when a suite builds its layer, so a missing DATABASE_URL_TEST fails the run.
const testDatabaseUrl = Config.Redacted("DATABASE_URL_TEST").pipe(
  Effect.orDie,
  Effect.flatMap(refuseNonTestDatabase),
);

// The pool keeps the clock it was built with; a test that pins `TestClock`
// would otherwise freeze the driver's connect and idle timers.
const liveClock = Layer.succeed(Clock.Clock, Clock.Clock.defaultValue());

const testDatabaseLayer = (behindTransactionPooler: boolean) =>
  Layer.unwrap(
    Effect.map(testDatabaseUrl, (url) =>
      Database.layer({ url, ssl: false, behindTransactionPooler }),
    ),
  ).pipe(Layer.provide(liveClock));

export const TestDatabaseLive = testDatabaseLayer(false);

// The client configured as the Worker runs it behind Hyperdrive.
export const TestPooledDatabaseLive = testDatabaseLayer(true);

// Tests always migrate from scratch: every module schema is dropped and the
// migrations replayed, once, from the integration global-setup.
export const migrateTestDatabase = testDatabaseUrl.pipe(
  Effect.flatMap((url) => resetAndMigrate({ url, ssl: false })),
  Effect.asVoid,
  Effect.provide(NodeServices.layer),
  Effect.orDie,
);

class UnqualifiedTable extends Schema.TaggedError<
  UnqualifiedTable,
  { readonly brand: "UnqualifiedTable" }
>()("UnqualifiedTable", {
  table: Schema.String,
}) {}

// Each table reference must be schema-qualified ("schema.table"). Cross-schema
// TRUNCATE CASCADE remains the test seam — application code never crosses
// schemas (enforced by the cross-schema lint rule).
const requireQualified = (qualified: string) =>
  Effect.succeed(qualified).pipe(
    Effect.filterOrFail(
      () => qualified.split(".").length === 2,
      () => new UnqualifiedTable({ table: qualified }),
    ),
    Effect.orDie,
  );

export const truncate = (...tables: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    for (const qualified of tables) {
      const table = yield* requireQualified(qualified);
      yield* sql`TRUNCATE TABLE ${sql(table)} CASCADE`;
    }
  }).pipe(Effect.orDie);
