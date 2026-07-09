import { describe, it } from "@effect/vitest";
import { Database, RowSchemas, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { beforeEach } from "vitest";

import { Api } from "@/api.js";
import { OrganizationCreated } from "@/modules/organization/index.js";
import { WalletRepository } from "@/modules/wallet/domain/ports/repositories/wallet.repository.js";
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

suite("CreateWalletWhenOrganizationIsCreated (integration)", () => {
  // `seedSuperAdminCaller` is required: creating an org inserts a
  // membership row FK'd to `"user".users(id)` for the caller. The fake
  // auth middleware reports `SUPER_ADMIN_CALLER_ID` as the CurrentUser;
  // without a seeded users row for that id, the membership insert
  // would FK-fail, the publisher tx would roll back, and the test
  // would see a 500 from POST /orgs — masking the wallet subscriber
  // path we're trying to verify.
  const { run } = useServerTestRuntime(WALLET_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("creates a wallet with balance 0 in the same transaction as the organization", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.organization.create({ payload: { name: "Acme" } });

        // Synchronous in-fiber dispatch: the wallet must be visible
        // immediately after the create-organization response returns. The
        // wallet module deliberately exposes no public read surface (no
        // HTTP endpoint, no query handler) — adding one purely for tests
        // would invert priorities. So this assertion drops to the
        // universal `Database.Database` service and queries the wallets
        // table by schema. The test still lives inside the wallet module,
        // so this is not a cross-module port reach — only the row schema
        // is coupled.
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

// Proves the load-bearing claim from ADR-0007: the synchronous in-fiber event
// bus runs subscribers inside the publisher's transaction, so a subscriber
// failure rolls back the publisher's writes. Drives a publisher-shaped
// effect (insert org via raw SQL → dispatch OrganizationCreated) inside
// tx.run, with a WalletRepository that defects on insert. After the failure,
// queries the organizations table directly to verify the insert was rolled
// back.
const probeOrgId = OrganizationId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const probeName = "Rollback Probe Org";

const FailingWalletRepository = Layer.succeed(
  WalletRepository,
  WalletRepository.of({
    insertOne: () => Effect.die("simulated wallet subscriber failure"),
    findOneByOrganizationId: () => Effect.succeed(Option.none()),
  }),
);

const RollbackTestLayer = Layer.mergeAll(UnitOfWorkLive, OrganizationEventAdapterLive).pipe(
  Layer.provideMerge(makeDomainEventBusLive()),
  Layer.provideMerge(makeIntegrationEventBusLive()),
  Layer.provideMerge(FailingWalletRepository),
  Layer.provideMerge(TestDatabaseLive),
);

suite("CreateWalletWhenOrganizationIsCreated (rollback integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("wallet.wallets", "organization.organizations").pipe(
        Effect.provide(TestDatabaseLive),
      ),
    );
  });

  it.effect("rolls back the publisher's writes when the wallet subscriber defects", () =>
    Effect.gen(function* () {
      const uow = yield* UnitOfWork;
      const bus = yield* DomainEventBus;
      const db = yield* Database.Database;

      // Inside the same transaction: insert an organizations row, then
      // dispatch OrganizationCreated. The (failing) wallet subscriber runs
      // synchronously in this fiber and inherits the transaction context.
      // Its defect must propagate out of uow.run and roll back the
      // organizations insert.
      const exit = yield* Effect.exit(
        uow.run(
          Effect.gen(function* () {
            yield* db.execute((c) =>
              c.query(sql.unsafe`
                INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
                VALUES (${probeOrgId}, ${probeName}, NOW(), NOW(), null)
              `),
            );
            yield* bus.dispatch([
              OrganizationCreated.make({ organizationId: probeOrgId, name: probeName }),
            ]);
          }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);

      // Rollback verification: the organizations row must not be present
      // after the surrounding transaction is undone.
      const rows = yield* db.execute((c) =>
        c.any(sql.type(RowSchemas.OrganizationRowStd)`
          SELECT * FROM "organization".organizations WHERE id = ${probeOrgId}
        `),
      );
      deepStrictEqual(rows.length, 0);
    }).pipe(Effect.provide(RollbackTestLayer)),
  );
});
