import { Api } from "@/api.js";
import { hasTestDatabase, runMigrations, truncate } from "@/test-utils/test-database.js";
import { TestServerLive } from "@/test-utils/test-server.js";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { Database, DbSchema } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as d from "drizzle-orm";
import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { afterAll, beforeAll, beforeEach } from "vitest";

type ServerContext = Layer.Layer.Success<typeof TestServerLive>;
type ServerError = Layer.Layer.Error<typeof TestServerLive>;

const basePayload = {
  email: "wallet-subscriber@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
};

const suite = hasTestDatabase ? describe.sequential : describe.skip;

// The event handler runs in a forked fiber after publishAll. Poll the DB
// briefly so the test isn't racy in CI.
const waitForWallet = (userId: string, attempts = 40) =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    for (let i = 0; i < attempts; i++) {
      const rows = yield* db.execute((c) =>
        c.query.walletsTable.findMany({
          where: d.eq(DbSchema.walletsTable.userId, userId),
        }),
      );
      if (rows.length > 0) return rows;
      yield* Effect.sleep("25 millis");
    }
    return [] as ReadonlyArray<typeof DbSchema.walletsTable.$inferSelect>;
  });

suite("CreateWalletWhenUserIsCreated (integration)", () => {
  let runtime: ManagedRuntime.ManagedRuntime<ServerContext, ServerError>;

  beforeAll(async () => {
    await runMigrations();
    runtime = ManagedRuntime.make(TestServerLive);
    await runtime.runPromise(Effect.void);
  });

  afterAll(async () => {
    await runtime.dispose();
  });

  beforeEach(async () => {
    await runtime.runPromise(
      Effect.gen(function* () {
        yield* truncate("wallets", "users");
      }),
    );
  });

  const run = <A, E>(effect: Effect.Effect<A, E, ServerContext>) => runtime.runPromise(effect);

  it("creates a wallet with balance 0 after a user is created", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.user.create({ payload: basePayload });

        const rows = yield* waitForWallet(id);
        deepStrictEqual(rows.length, 1);
        const wallet = rows[0];
        ok(wallet !== undefined);
        deepStrictEqual(wallet.userId, id);
        deepStrictEqual(wallet.balance, 0);
      }),
    );
  });
});
