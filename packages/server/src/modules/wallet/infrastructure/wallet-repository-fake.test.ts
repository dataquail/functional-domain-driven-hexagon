import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletRepository } from "../domain/ports/repositories/wallet-repository.js";
import * as Wallet from "../domain/wallet.aggregate.js";
import { WalletAlreadyExistsForOrganization } from "../domain/wallet-errors.js";
import { WalletId } from "../domain/wallet-id.js";
import { WalletRepositoryFake } from "./wallet-repository-fake.js";

const acmeId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const betaId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const walletA = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const walletB = WalletId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const provide = Effect.provide(WalletRepositoryFake);

describe("WalletRepositoryFake", () => {
  describe("insert", () => {
    it.effect("stores a wallet and makes it findable by organizationId", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;
        const { wallet } = Wallet.create({ id: walletA, organizationId: acmeId, now });
        yield* repo.insert(wallet);
        const found = yield* repo.findByOrganizationId(acmeId);
        ok(Option.isSome(found));
        if (Option.isSome(found)) {
          deepStrictEqual(found.value.id, walletA);
          deepStrictEqual(found.value.organizationId, acmeId);
          deepStrictEqual(found.value.balance, 0);
        }
      }).pipe(provide),
    );

    it.effect(
      "fails WalletAlreadyExistsForOrganization when a wallet already exists for the org",
      () =>
        Effect.gen(function* () {
          const repo = yield* WalletRepository;
          const { wallet: first } = Wallet.create({ id: walletA, organizationId: acmeId, now });
          const { wallet: clashing } = Wallet.create({ id: walletB, organizationId: acmeId, now });
          yield* repo.insert(first);
          const exit = yield* Effect.exit(repo.insert(clashing));
          ok(Exit.isFailure(exit));
          if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
            const err = exit.cause.error;
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
        const { wallet: acmeWallet } = Wallet.create({
          id: walletA,
          organizationId: acmeId,
          now,
        });
        const { wallet: betaWallet } = Wallet.create({
          id: walletB,
          organizationId: betaId,
          now,
        });
        yield* repo.insert(acmeWallet);
        yield* repo.insert(betaWallet);
        const acmeFound = yield* repo.findByOrganizationId(acmeId);
        const betaFound = yield* repo.findByOrganizationId(betaId);
        ok(Option.isSome(acmeFound));
        ok(Option.isSome(betaFound));
        if (Option.isSome(acmeFound)) deepStrictEqual(acmeFound.value.id, walletA);
        if (Option.isSome(betaFound)) deepStrictEqual(betaFound.value.id, walletB);
      }).pipe(provide),
    );
  });

  describe("findByOrganizationId", () => {
    it.effect("returns None when no wallet exists for the org", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;
        const result = yield* repo.findByOrganizationId(acmeId);
        ok(Option.isNone(result));
      }).pipe(provide),
    );
  });

  describe("isolation", () => {
    it.effect("each Layer acquisition gets its own store", () =>
      Effect.gen(function* () {
        const repo1 = yield* WalletRepository;
        const { wallet } = Wallet.create({ id: walletA, organizationId: acmeId, now });
        yield* repo1.insert(wallet);
        const exists = yield* repo1.findByOrganizationId(acmeId);
        ok(Option.isSome(exists));
      }).pipe(provide, (first) =>
        Effect.zipRight(
          first,
          Effect.gen(function* () {
            const repo2 = yield* WalletRepository;
            const empty = yield* repo2.findByOrganizationId(acmeId);
            ok(Option.isNone(empty));
          }).pipe(provide),
        ),
      ),
    );
  });
});
