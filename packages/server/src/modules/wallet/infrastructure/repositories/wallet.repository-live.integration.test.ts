import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { beforeEach } from "vitest";

import { WalletRepository } from "@/modules/wallet/domain/ports/repositories/wallet.repository.js";
import { WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet.errors.js";
import { WalletId } from "@/modules/wallet/domain/wallet.id.js";
import { WalletRootOps } from "@/modules/wallet/domain/wallet.root.js";
import { WalletRepositoryLive } from "@/modules/wallet/infrastructure/repositories/wallet.repository-live.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const otherOrgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const walletId = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const otherWalletId = WalletId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const acmeWallet = WalletRootOps.create({ id: walletId, organizationId, now }).wallet;

// FK precondition only. The org row exists solely to satisfy
// `wallets_organization_id_organizations_id_fk`; it is not the subject
// of these tests. Going through the org module's HTTP layer to seed
// it would also fire the `CreateWalletWhenOrganizationIsCreated` event
// handler and create a wallet as a side effect, defeating the test
// setup. Direct SQL is the smallest, most honest seam for a cross-
// module FK precondition.
const seedOrgRow = (id: OrganizationId) =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    yield* db
      .execute((c) =>
        c.query(sql.unsafe`
          INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
          VALUES (${id}, 'Acme', NOW(), NOW(), null)
        `),
      )
      .pipe(Effect.orDie);
  });

const TestLayer = WalletRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const suite = describe.sequential;

suite("WalletRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("wallet.wallets", "organization.organizations").pipe(
        Effect.provide(TestDatabaseLive),
      ),
    );
  });

  describe("insert", () => {
    it.effect("persists the wallet and decodes it back via findOneByOrganizationId", () =>
      Effect.gen(function* () {
        yield* seedOrgRow(organizationId);
        const repo = yield* WalletRepository;
        yield* repo.insertOne(acmeWallet);
        const found = yield* repo.findOneByOrganizationId(organizationId);
        deepStrictEqual(Option.isSome(found), true);
        if (Option.isSome(found)) {
          deepStrictEqual(found.value.id, acmeWallet.id);
          deepStrictEqual(found.value.organizationId, organizationId);
          deepStrictEqual(found.value.balance, 0);
        }
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "fails WalletAlreadyExistsForOrganization on duplicate organization_id (unique violation → domain error)",
      () =>
        Effect.gen(function* () {
          yield* seedOrgRow(organizationId);
          const repo = yield* WalletRepository;
          yield* repo.insertOne(acmeWallet);
          const clashing = WalletRootOps.create({ id: otherWalletId, organizationId, now }).wallet;
          const exit = yield* Effect.exit(repo.insertOne(clashing));
          deepStrictEqual(Exit.isFailure(exit), true);
          if (Exit.isFailure(exit)) {
            const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
            deepStrictEqual(error instanceof WalletAlreadyExistsForOrganization, true);
            deepStrictEqual(
              (error as WalletAlreadyExistsForOrganization).organizationId,
              organizationId,
            );
          }
        }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("findOneByOrganizationId", () => {
    it.effect("returns None when no wallet exists for the org", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;
        const result = yield* repo.findOneByOrganizationId(otherOrgId);
        deepStrictEqual(Option.isNone(result), true);
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
