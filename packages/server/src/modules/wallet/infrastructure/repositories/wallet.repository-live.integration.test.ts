import { deepStrictEqual, ok } from "node:assert";

import { describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet/wallet.errors.js";
import { WalletId } from "@/modules/wallet/domain/wallet/wallet.id.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository.js";
import { WalletRootOps } from "@/modules/wallet/domain/wallet/wallet.root-ops.js";
import { WalletSpecifications } from "@/modules/wallet/domain/wallet/wallet.specification.js";
import { WalletRepositoryLive } from "@/modules/wallet/infrastructure/repositories/wallet.repository-live.js";
import { describeIntegration } from "@/test-utils/server-test-runtime.js";
import { TestDatabaseLive } from "@/test-utils/test-database.js";

const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const otherOrgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const walletId = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const otherWalletId = WalletId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

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
    const sql = yield* Database.Database;
    yield* sql`
          INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
          VALUES (${id}, 'Acme', NOW(), NOW(), null)
        `.pipe(Effect.orDie);
  });

const TestLayer = WalletRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describeIntegration(
  "WalletRepositoryLive (integration)",
  { layer: TestLayer, tables: ["wallet.wallets", "organization.organizations"] },
  (it) => {
    describe("insert", () => {
      it.effect("persists the wallet and decodes it back via findOne", () =>
        Effect.gen(function* () {
          yield* seedOrgRow(organizationId);
          const repo = yield* WalletRepository;
          yield* repo.insertOne(acmeWallet);

          const found = yield* Effect.fromOption(
            yield* repo.findOne(WalletSpecifications.forOrganization(organizationId)),
          );

          deepStrictEqual(found.id, acmeWallet.id);
          deepStrictEqual(found.organizationId, organizationId);
          deepStrictEqual(found.balance, 0);
        }),
      );

      it.effect(
        "fails WalletAlreadyExistsForOrganization on duplicate organization_id (unique violation → domain error)",
        () =>
          Effect.gen(function* () {
            yield* seedOrgRow(organizationId);
            const repo = yield* WalletRepository;
            yield* repo.insertOne(acmeWallet);

            const clashing = WalletRootOps.create({
              id: otherWalletId,
              organizationId,
              now,
            }).wallet;

            const error = yield* Effect.flip(repo.insertOne(clashing));
            ok(Schema.is(WalletAlreadyExistsForOrganization)(error));
            deepStrictEqual(error.organizationId, organizationId);
          }),
      );
    });

    describe("findOne", () => {
      it.effect("returns none when no wallet exists for the org", () =>
        Effect.gen(function* () {
          const repo = yield* WalletRepository;
          assertNone(yield* repo.findOne(WalletSpecifications.forOrganization(otherOrgId)));
        }),
      );
    });
  },
);
