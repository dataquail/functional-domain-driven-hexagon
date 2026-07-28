import { describe, it } from "@effect/vitest";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import { Command, CommandBus, makeCommandBus, mergeDispatchTables } from "@org/cqrs";
import { Database, RowSchemas, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { beforeEach } from "vitest";

import { Api } from "@/api.js";
import { OrganizationCreated } from "@/modules/organization/index.js";
import { createWallet } from "@/modules/wallet/commands/create-wallet.handler.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository.js";
import { walletCommandGroup, WalletCommands, WalletCommandsLive } from "@/modules/wallet/index.js";
import { OrganizationEventAdapterLive } from "@/modules/wallet/interface/events/organization.event-adapter.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { makeDomainEventBusLive } from "@/platform/domain-event-bus-live.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { makeIntegrationEventBusLive } from "@/platform/integration-event-bus-live.js";
import { UnitOfWorkLive } from "@/platform/unit-of-work-live.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const WALLET_TABLES = [
  "wallet.wallets",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

const suite = describe.sequential;

suite("organization → wallet adapter (integration)", () => {
  // `seedSuperAdminCaller` is required: creating an org inserts a
  // membership row FK'd to `"user".users(id)` for the caller. Without a
  // seeded users row for the fake-auth CurrentUser, the membership insert
  // FK-fails, the publisher tx rolls back, and the test sees a 500 from
  // POST /orgs — masking the wallet path we're verifying.
  const { run } = useServerTestRuntime(WALLET_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("creates a wallet with balance 0 in the same transaction as the organization", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        // Synchronous in-fiber dispatch: the adapter dispatches
        // CreateWalletCommand, whose handler runs as a nested savepoint in
        // the org-creation transaction, so the wallet is visible immediately
        // after the create response returns. The wallet module exposes no
        // public read surface, so this drops to `Database.Database` and
        // queries the wallets table by schema (only the row schema is
        // coupled — not a cross-module port reach).
        const db = yield* Database.Database;
        const rows = yield* db.execute((c) =>
          c.any(sql.type(RowSchemas.WalletRowStd)`
            SELECT * FROM wallet.wallets WHERE organization_id = ${id}
          `),
        );
        deepStrictEqual(rows.length, 1);
        const wallet = rows[0];
        ok(wallet !== undefined);
        deepStrictEqual(wallet.organization_id, id);
        deepStrictEqual(wallet.balance, 0);
      }),
    );
  });
});

// Proves the load-bearing claim from ADR-0007 under the command-dispatch
// model: the adapter dispatches CreateWalletCommand synchronously in the
// publisher's fiber; the command's `withUnitOfWork` opens a nested
// savepoint, and an uncaught failure inside it propagates out of dispatch
// and rolls the publisher's writes back. Drives a publisher-shaped effect
// (insert org via raw SQL → dispatch OrganizationCreated) inside tx.run,
// with a CreateWallet handler whose repository defects on insert. After
// the failure, queries the organizations table to verify the rollback.
const probeOrgId = OrganizationId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const probeName = "Rollback Probe Org";

// The publisher's own write. `makeQuery`, not `execute`: inside a unit of work
// only `makeQuery` joins the ambient transaction, and a bare `execute` takes a
// foreign pool connection and dies — which would satisfy "the unit of work
// failed" without the dispatch ever having run.
const insertProbeOrg = Effect.flatMap(Database.Database, (db) =>
  db.makeQuery((execute) =>
    execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${probeOrgId}, ${probeName}, NOW(), NOW(), null)
      `),
    ),
  )(),
);

const FailingWalletRepository = Layer.succeed(
  WalletRepository,
  WalletRepository.of({
    insertOne: () => Effect.die("simulated wallet command failure"),
    findOne: () => Effect.succeed(null),
  }),
);

// A command bus routing only CreateWallet, backed by the failing repository. The table
// holds nothing else, so a dispatch of any other tag dies with "no handler registered"
// rather than quietly exercising a different path.
const FailingCommandBusLive = Layer.effect(
  CommandBus,
  Effect.gen(function* () {
    const failingWallet = yield* Command.dispatcher(walletCommandGroup);
    return makeCommandBus(mergeDispatchTables(failingWallet));
  }),
).pipe(
  Layer.provide(
    Command.handlersOf(walletCommandGroup, {
      CreateWalletCommand: (payload) =>
        createWallet(payload).pipe(Effect.provide(FailingWalletRepository)),
    }),
  ),
);

// The mirror of the rollback case, and the one that actually pins transaction
// joining: here the dispatched command SUCCEEDS and the publisher fails
// afterwards. If the rpc-dispatched write had run on its own connection rather
// than joining the publisher's transaction, the wallet row would survive the
// publisher's rollback.
const WorkingCommandBusLive = Layer.effect(
  CommandBus,
  Effect.gen(function* () {
    const wallet = yield* WalletCommands;
    return makeCommandBus(mergeDispatchTables(wallet));
  }),
).pipe(Layer.provide(WalletCommandsLive));

// The adapter `yield*`s DomainEventBus/CommandBus at build time, so they must be
// provided *into* it (provideMerge), not merged as siblings. provideMerge
// re-exports each so the test can still yield UnitOfWork/DomainEventBus/Database
// itself. The command bus sits directly under the adapter and above the unit of
// work, because the rpc handler layer it wraps demands DomainEventBus +
// UnitOfWork of its own — only what is lower in this chain provides to it.
const DomainEventBusTestLive = makeDomainEventBusLive();

const withBusUnder = (
  commandBus: Layer.Layer<CommandBus, never, DomainEventBus | UnitOfWork | Database.Database>,
) =>
  OrganizationEventAdapterLive.pipe(
    Layer.provideMerge(commandBus),
    Layer.provideMerge(Layer.mergeAll(DomainEventBusTestLive, UnitOfWorkLive)),
    Layer.provideMerge(makeIntegrationEventBusLive()),
    Layer.provideMerge(TestDatabaseLive),
  );

const RollbackTestLayer = withBusUnder(FailingCommandBusLive);

suite("organization → wallet adapter (rollback integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("wallet.wallets", "organization.organizations").pipe(
        Effect.provide(TestDatabaseLive),
      ),
    );
  });

  it.effect("rolls back the publisher's writes when the dispatched command defects", () =>
    Effect.gen(function* () {
      const uow = yield* UnitOfWork;
      const bus = yield* DomainEventBus;
      const db = yield* Database.Database;

      const exit = yield* Effect.exit(
        uow.run(
          Effect.gen(function* () {
            yield* insertProbeOrg;
            yield* bus.dispatch([
              OrganizationCreated.make({ organizationId: probeOrgId, name: probeName }),
            ]);
          }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);

      const rows = yield* db.execute((c) =>
        c.any(sql.type(RowSchemas.OrganizationRowStd)`
          SELECT * FROM "organization".organizations WHERE id = ${probeOrgId}
        `),
      );
      deepStrictEqual(rows.length, 0);
    }).pipe(Effect.provide(RollbackTestLayer)),
  );
});

const JoinTestLayer = withBusUnder(WorkingCommandBusLive);

suite("organization → wallet adapter (transaction-join integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("wallet.wallets", "organization.organizations").pipe(
        Effect.provide(TestDatabaseLive),
      ),
    );
  });

  // Control for the test below: without the publisher's failure the very same
  // flow leaves a wallet row behind. Without this, "no wallet row" would also be
  // satisfied by a dispatch that silently did nothing — `createWallet` is
  // idempotent and swallows a duplicate, so a no-op is a real possibility.
  it.effect("inserts the wallet when the publisher commits", () =>
    Effect.gen(function* () {
      const uow = yield* UnitOfWork;
      const bus = yield* DomainEventBus;
      const db = yield* Database.Database;

      yield* uow.run(
        Effect.gen(function* () {
          yield* insertProbeOrg;
          yield* bus.dispatch([
            OrganizationCreated.make({ organizationId: probeOrgId, name: probeName }),
          ]);
        }),
      );

      const wallets = yield* db.execute((c) =>
        c.any(sql.type(RowSchemas.WalletRowStd)`
          SELECT * FROM wallet.wallets WHERE organization_id = ${probeOrgId}
        `),
      );
      deepStrictEqual(wallets.length, 1);
    }).pipe(Effect.provide(JoinTestLayer)),
  );

  it.effect("discards the dispatched command's write when the publisher rolls back", () =>
    Effect.gen(function* () {
      const uow = yield* UnitOfWork;
      const bus = yield* DomainEventBus;
      const db = yield* Database.Database;

      const exit = yield* Effect.exit(
        uow.run(
          Effect.gen(function* () {
            yield* insertProbeOrg;
            // Succeeds, inserting a wallet row inside the publisher's transaction.
            yield* bus.dispatch([
              OrganizationCreated.make({ organizationId: probeOrgId, name: probeName }),
            ]);
            return yield* Effect.fail("publisher failed after the wallet was created");
          }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);

      const wallets = yield* db.execute((c) =>
        c.any(sql.type(RowSchemas.WalletRowStd)`
          SELECT * FROM wallet.wallets WHERE organization_id = ${probeOrgId}
        `),
      );
      deepStrictEqual(wallets.length, 0);
    }).pipe(Effect.provide(JoinTestLayer)),
  );
});
