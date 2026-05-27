import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { UserId } from "@/platform/ids/user-id.js";

import { WalletRepository } from "../domain/ports/repositories/wallet-repository.js";
import * as Wallet from "../domain/wallet.aggregate.js";
import { WalletAlreadyExistsForUser } from "../domain/wallet-errors.js";
import { WalletId } from "../domain/wallet-id.js";
import { WalletRepositoryFake } from "./wallet-repository-fake.js";

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const walletA = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const walletB = WalletId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const provide = Effect.provide(WalletRepositoryFake);

describe("WalletRepositoryFake", () => {
  describe("insert", () => {
    it.effect("stores a wallet and makes it findable by userId", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;
        const { wallet } = Wallet.create({ id: walletA, userId: aliceId, now });
        yield* repo.insert(wallet);
        const found = yield* repo.findByUserId(aliceId);
        ok(Option.isSome(found));
        if (Option.isSome(found)) {
          deepStrictEqual(found.value.id, walletA);
          deepStrictEqual(found.value.userId, aliceId);
          deepStrictEqual(found.value.balance, 0);
        }
      }).pipe(provide),
    );

    it.effect("fails WalletAlreadyExistsForUser when a wallet already exists for the user", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;
        const { wallet: first } = Wallet.create({ id: walletA, userId: aliceId, now });
        const { wallet: clashing } = Wallet.create({ id: walletB, userId: aliceId, now });
        yield* repo.insert(first);
        const exit = yield* Effect.exit(repo.insert(clashing));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          const err = exit.cause.error;
          ok(err instanceof WalletAlreadyExistsForUser);
          if (err instanceof WalletAlreadyExistsForUser) {
            deepStrictEqual(err.userId, aliceId);
          }
        }
      }).pipe(provide),
    );

    it.effect("allows different users to each have their own wallet", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;
        const { wallet: aliceWallet } = Wallet.create({ id: walletA, userId: aliceId, now });
        const { wallet: bobWallet } = Wallet.create({ id: walletB, userId: bobId, now });
        yield* repo.insert(aliceWallet);
        yield* repo.insert(bobWallet);
        const aliceFound = yield* repo.findByUserId(aliceId);
        const bobFound = yield* repo.findByUserId(bobId);
        ok(Option.isSome(aliceFound));
        ok(Option.isSome(bobFound));
        if (Option.isSome(aliceFound)) deepStrictEqual(aliceFound.value.id, walletA);
        if (Option.isSome(bobFound)) deepStrictEqual(bobFound.value.id, walletB);
      }).pipe(provide),
    );
  });

  describe("findByUserId", () => {
    it.effect("returns None when no wallet exists for the user", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;
        const result = yield* repo.findByUserId(aliceId);
        ok(Option.isNone(result));
      }).pipe(provide),
    );
  });

  describe("isolation", () => {
    it.effect("each Layer acquisition gets its own store", () =>
      Effect.gen(function* () {
        const repo1 = yield* WalletRepository;
        const { wallet } = Wallet.create({ id: walletA, userId: aliceId, now });
        yield* repo1.insert(wallet);
        const exists = yield* repo1.findByUserId(aliceId);
        ok(Option.isSome(exists));
      }).pipe(provide, (first) =>
        Effect.zipRight(
          first,
          Effect.gen(function* () {
            const repo2 = yield* WalletRepository;
            const empty = yield* repo2.findByUserId(aliceId);
            ok(Option.isNone(empty));
          }).pipe(provide),
        ),
      ),
    );
  });
});
