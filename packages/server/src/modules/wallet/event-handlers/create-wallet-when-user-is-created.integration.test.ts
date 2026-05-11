import { Api } from "@/api.js";
import { UserCreated } from "@/modules/user/index.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet-repository.js";
import { UserEventAdapterLive } from "@/modules/wallet/event-handlers/user-event-adapter.js";
import { DomainEventBus, makeDomainEventBusLive } from "@/platform/domain-event-bus.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TransactionRunner, TransactionRunnerLive } from "@/platform/transaction-runner.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";
import { TestServerLive } from "@/test-utils/test-server.js";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { Database, RowSchemas, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Option from "effect/Option";
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
        // immediately after the create-user response returns. The wallet
        // module deliberately exposes no public read surface (no HTTP
        // endpoint, no query handler) — adding one purely for tests would
        // invert priorities. So this assertion drops to the universal
        // `Database.Database` service and queries the wallets table by
        // schema. The test still lives inside the wallet module, so this is
        // not a cross-module port reach — only the row schema is coupled.
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

// Proves the load-bearing claim from ADR-0009: the synchronous in-fiber event
// bus runs subscribers inside the publisher's transaction, so a subscriber
// failure rolls back the publisher's writes. Drives a publisher-shaped
// effect (insert via raw SQL → dispatch UserCreated) inside tx.run, with a
// WalletRepository that defects on insert. After the failure, queries the
// users table directly to verify the insert was rolled back.
const probeUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const probeEmail = "rollback-probe@example.com";

const FailingWalletRepository = Layer.succeed(
  WalletRepository,
  WalletRepository.of({
    insert: () => Effect.die("simulated wallet subscriber failure"),
    findByUserId: () => Effect.succeed(Option.none()),
  }),
);

const RollbackTestLayer = Layer.mergeAll(TransactionRunnerLive, UserEventAdapterLive).pipe(
  Layer.provideMerge(makeDomainEventBusLive()),
  Layer.provideMerge(FailingWalletRepository),
  Layer.provideMerge(TestDatabaseLive),
);

suite("CreateWalletWhenUserIsCreated (rollback integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("wallets", "users").pipe(Effect.provide(TestDatabaseLive)));
  });

  it.effect("rolls back the publisher's writes when the wallet subscriber defects", () =>
    Effect.gen(function* () {
      const tx = yield* TransactionRunner;
      const bus = yield* DomainEventBus;
      const db = yield* Database.Database;

      // Inside the same transaction: insert a users row, then dispatch
      // UserCreated. The (failing) wallet subscriber runs synchronously in
      // this fiber and inherits the transaction context. Its defect must
      // propagate out of tx.run and roll back the users insert.
      const exit = yield* Effect.exit(
        tx.run(
          Effect.gen(function* () {
            yield* db.execute((c) =>
              c.query(sql.unsafe`
                INSERT INTO users (id, email, role, country, street, postal_code, created_at, updated_at)
                VALUES (
                  ${probeUserId},
                  ${probeEmail},
                  'guest',
                  'USA',
                  '123 Rollback Ln',
                  '12345',
                  NOW(),
                  NOW()
                )
              `),
            );
            yield* bus.dispatch([
              UserCreated.make({
                userId: probeUserId,
                email: probeEmail,
                address: { country: "USA", street: "123 Rollback Ln", postalCode: "12345" },
              }),
            ]);
          }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);

      // Rollback verification: the users row must not be present after the
      // surrounding transaction is undone.
      const rows = yield* db.execute((c) =>
        c.any(sql.type(RowSchemas.UserRowStd)`
          SELECT * FROM users WHERE id = ${probeUserId}
        `),
      );
      deepStrictEqual(rows.length, 0);
    }).pipe(Effect.provide(RollbackTestLayer)),
  );
});
