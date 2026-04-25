import { Api } from "@/api.js";
import { hasTestDatabase, truncate } from "@/test-utils/test-database.js";
import { TestServerLive } from "@/test-utils/test-server.js";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { Database, RowSchemas, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
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

suite("CreateWalletWhenUserIsCreated (integration)", () => {
  let runtime: ManagedRuntime.ManagedRuntime<ServerContext, ServerError>;

  beforeAll(async () => {
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

  it("creates a wallet with balance 0 in the same transaction as the user", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.user.create({ payload: basePayload });

        // Synchronous in-fiber dispatch: the wallet must be visible
        // immediately after the create-user response returns.
        const db = yield* Database.Database;
        const rows = yield* db.execute((c) =>
          c.any(sql.type(RowSchemas.WalletRowStd)`
            SELECT * FROM wallets WHERE user_id = ${id}
          `),
        );
        deepStrictEqual(rows.length, 1);
        const wallet = rows[0];
        ok(wallet !== undefined);
        deepStrictEqual(wallet.user_id, id);
        deepStrictEqual(wallet.balance, 0);
      }),
    );
  });
});
