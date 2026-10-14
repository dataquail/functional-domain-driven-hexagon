import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet/wallet.errors.ts";
import { WalletId } from "@/modules/wallet/domain/wallet/wallet.id.ts";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository.ts";
import { WalletRootOps } from "@/modules/wallet/domain/wallet/wallet.root-ops.ts";
import { WalletSpecifications } from "@/modules/wallet/domain/wallet/wallet.specification.ts";

import { WalletRepositoryFake } from "./wallet.repository-fake.ts";

const acmeId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const betaId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const walletA = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const walletB = WalletId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const provide = Effect.provide(WalletRepositoryFake);

describe("WalletRepositoryFake", () => {
  describe("insert", () => {
    it.effect("stores a wallet and makes it findable by organizationId", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;
        const { wallet } = WalletRootOps.create({ id: walletA, organizationId: acmeId, now });
        yield* repo.insertOne(wallet);

        const found = yield* Effect.fromOption(
          yield* repo.findOne(WalletSpecifications.forOrganization(acmeId)),
        );

        deepStrictEqual(found.id, walletA);
        deepStrictEqual(found.organizationId, acmeId);
        deepStrictEqual(found.balance, 0);
      }).pipe(provide),
    );

    it.effect(
      "fails WalletAlreadyExistsForOrganization when a wallet already exists for the org",
      () =>
        Effect.gen(function* () {
          const repo = yield* WalletRepository;

          const { wallet: first } = WalletRootOps.create({
            id: walletA,
            organizationId: acmeId,
            now,
          });

          const { wallet: clashing } = WalletRootOps.create({
            id: walletB,
            organizationId: acmeId,
            now,
          });

          yield* repo.insertOne(first);
          const err = yield* Effect.flip(repo.insertOne(clashing));
          ok(Schema.is(WalletAlreadyExistsForOrganization)(err));
          deepStrictEqual(err.organizationId, acmeId);
        }).pipe(provide),
    );

    it.effect("allows different organizations to each have their own wallet", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;

        const { wallet: acmeWallet } = WalletRootOps.create({
          id: walletA,
          organizationId: acmeId,
          now,
        });

        const { wallet: betaWallet } = WalletRootOps.create({
          id: walletB,
          organizationId: betaId,
          now,
        });

        yield* repo.insertOne(acmeWallet);
        yield* repo.insertOne(betaWallet);

        const acmeFound = yield* Effect.fromOption(
          yield* repo.findOne(WalletSpecifications.forOrganization(acmeId)),
        );

        const betaFound = yield* Effect.fromOption(
          yield* repo.findOne(WalletSpecifications.forOrganization(betaId)),
        );

        deepStrictEqual(acmeFound.id, walletA);
        deepStrictEqual(betaFound.id, walletB);
      }).pipe(provide),
    );
  });

  describe("findOne", () => {
    it.effect("returns none when no wallet exists for the org", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;
        assertNone(yield* repo.findOne(WalletSpecifications.forOrganization(acmeId)));
      }).pipe(provide),
    );
  });

  describe("isolation", () => {
    it.effect("each Layer acquisition gets its own store", () =>
      Effect.gen(function* () {
        const repo1 = yield* WalletRepository;
        const { wallet } = WalletRootOps.create({ id: walletA, organizationId: acmeId, now });
        yield* repo1.insertOne(wallet);
        const exists = yield* repo1.findOne(WalletSpecifications.forOrganization(acmeId));
        ok(Option.isSome(exists));
      }).pipe(provide, (first) =>
        Effect.andThen(
          first,
          Effect.gen(function* () {
            const repo2 = yield* WalletRepository;
            assertNone(yield* repo2.findOne(WalletSpecifications.forOrganization(acmeId)));
          }).pipe(provide),
        ),
      ),
    );
  });
});
