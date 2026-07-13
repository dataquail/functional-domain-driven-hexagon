import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet/wallet.errors.js";
import { WalletId } from "@/modules/wallet/domain/wallet/wallet.id.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository.js";
import { WalletRootOps } from "@/modules/wallet/domain/wallet/wallet.root-ops.js";
import { WalletSpecifications } from "@/modules/wallet/domain/wallet/wallet.specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletRepositoryFake } from "./wallet.repository-fake.js";

const acmeId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const betaId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const walletA = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const walletB = WalletId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const provide = Effect.provide(WalletRepositoryFake);

describe("WalletRepositoryFake", () => {
  describe("insert", () => {
    it.effect("stores a wallet and makes it findable by organizationId", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;
        const { wallet } = WalletRootOps.create({ id: walletA, organizationId: acmeId, now });
        yield* repo.insertOne(wallet);
        const found = yield* repo.findOne(WalletSpecifications.forOrganization(acmeId));
        if (found === null) throw new Error("expected stored wallet");
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
          const exit = yield* Effect.exit(repo.insertOne(clashing));
          ok(Exit.isFailure(exit));
          if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
            const err = Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow);
            ok(err instanceof WalletAlreadyExistsForOrganization);
            if (err instanceof WalletAlreadyExistsForOrganization) {
              deepStrictEqual(err.organizationId, acmeId);
            }
          }
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
        const acmeFound = yield* repo.findOne(WalletSpecifications.forOrganization(acmeId));
        const betaFound = yield* repo.findOne(WalletSpecifications.forOrganization(betaId));
        if (acmeFound === null) throw new Error("expected acme wallet");
        if (betaFound === null) throw new Error("expected beta wallet");
        deepStrictEqual(acmeFound.id, walletA);
        deepStrictEqual(betaFound.id, walletB);
      }).pipe(provide),
    );
  });

  describe("findOne", () => {
    it.effect("returns null when no wallet exists for the org", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;
        const result = yield* repo.findOne(WalletSpecifications.forOrganization(acmeId));
        ok(result === null);
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
        ok(exists !== null);
      }).pipe(provide, (first) =>
        Effect.andThen(
          first,
          Effect.gen(function* () {
            const repo2 = yield* WalletRepository;
            const empty = yield* repo2.findOne(WalletSpecifications.forOrganization(acmeId));
            ok(empty === null);
          }).pipe(provide),
        ),
      ),
    );
  });
});
