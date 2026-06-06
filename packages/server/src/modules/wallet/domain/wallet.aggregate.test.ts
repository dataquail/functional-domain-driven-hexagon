import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Either from "effect/Either";

import * as Wallet from "@/modules/wallet/domain/wallet.aggregate.js";
import {
  WalletInsufficientFunds,
  WalletInvalidAmount,
} from "@/modules/wallet/domain/wallet-errors.js";
import { WalletId } from "@/modules/wallet/domain/wallet-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

const walletId = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));
const later = DateTime.unsafeMake(new Date("2025-02-01T00:00:00Z"));

const fresh = () => Wallet.create({ id: walletId, organizationId, now }).wallet;

describe("Wallet.create", () => {
  it("constructs a wallet with balance 0 and the given ids/timestamps", () => {
    const { wallet } = Wallet.create({ id: walletId, organizationId, now });
    deepStrictEqual(wallet.id, walletId);
    deepStrictEqual(wallet.organizationId, organizationId);
    deepStrictEqual(wallet.balance, 0);
    deepStrictEqual(wallet.createdAt, now);
    deepStrictEqual(wallet.updatedAt, now);
  });

  it("emits exactly one WalletCreated event carrying the wallet and organization ids", () => {
    const { events } = Wallet.create({ id: walletId, organizationId, now });
    deepStrictEqual(events.length, 1);
    const event = events[0];
    ok(event !== undefined);
    // `events` is inferred narrowly as `[WalletCreated]` here because
    // `Wallet.create` only ever produces a WalletCreated; reading
    // `walletId`/`organizationId` requires no further narrowing.
    deepStrictEqual(event._tag, "WalletCreated");
    deepStrictEqual(event.walletId, walletId);
    deepStrictEqual(event.organizationId, organizationId);
  });
});

describe("Wallet.credit", () => {
  it("increases balance by amount and emits WalletCredited with the new balance", () => {
    const result = Wallet.credit(fresh(), { amount: 100, now: later });
    ok(Either.isRight(result));
    if (!Either.isRight(result)) throw new Error("unreachable");
    const { events, wallet } = result.right;
    deepStrictEqual(wallet.balance, 100);
    deepStrictEqual(wallet.updatedAt, later);
    deepStrictEqual(events.length, 1);
    const event = events[0];
    ok(event !== undefined);
    if (event._tag !== "WalletCredited") throw new Error("expected WalletCredited");
    deepStrictEqual(event.amount, 100);
    deepStrictEqual(event.newBalance, 100);
  });

  it("rejects zero or negative amounts (invariant: amount must be positive)", () => {
    const zero = Wallet.credit(fresh(), { amount: 0, now: later });
    const negative = Wallet.credit(fresh(), { amount: -10, now: later });
    ok(Either.isLeft(zero));
    ok(Either.isLeft(negative));
    if (Either.isLeft(zero)) ok(zero.left instanceof WalletInvalidAmount);
    if (Either.isLeft(negative)) ok(negative.left instanceof WalletInvalidAmount);
  });

  it("rejects non-finite amounts (NaN, Infinity)", () => {
    const nan = Wallet.credit(fresh(), { amount: NaN, now: later });
    const inf = Wallet.credit(fresh(), { amount: Infinity, now: later });
    ok(Either.isLeft(nan));
    ok(Either.isLeft(inf));
  });
});

describe("Wallet.debit", () => {
  const funded = (): Wallet.Wallet => {
    const credited = Wallet.credit(fresh(), { amount: 100, now });
    if (!Either.isRight(credited)) throw new Error("setup credit failed");
    return credited.right.wallet;
  };

  it("decreases balance by amount and emits WalletDebited with the new balance", () => {
    const result = Wallet.debit(funded(), { amount: 30, now: later });
    ok(Either.isRight(result));
    if (!Either.isRight(result)) throw new Error("unreachable");
    const { events, wallet } = result.right;
    deepStrictEqual(wallet.balance, 70);
    deepStrictEqual(wallet.updatedAt, later);
    const event = events[0];
    ok(event !== undefined);
    if (event._tag !== "WalletDebited") throw new Error("expected WalletDebited");
    deepStrictEqual(event.amount, 30);
    deepStrictEqual(event.newBalance, 70);
  });

  it("rejects a debit that would overdraft (invariant: balance never goes negative)", () => {
    const result = Wallet.debit(funded(), { amount: 101, now: later });
    ok(Either.isLeft(result));
    if (!Either.isLeft(result)) throw new Error("unreachable");
    ok(result.left instanceof WalletInsufficientFunds);
    if (result.left instanceof WalletInsufficientFunds) {
      deepStrictEqual(result.left.balance, 100);
      deepStrictEqual(result.left.attemptedDebit, 101);
    }
  });

  it("allows debiting the exact balance (drains to zero)", () => {
    const result = Wallet.debit(funded(), { amount: 100, now: later });
    ok(Either.isRight(result));
    if (!Either.isRight(result)) throw new Error("unreachable");
    deepStrictEqual(result.right.wallet.balance, 0);
  });

  it("rejects zero or negative amounts (invariant: amount must be positive)", () => {
    const zero = Wallet.debit(funded(), { amount: 0, now: later });
    const negative = Wallet.debit(funded(), { amount: -1, now: later });
    ok(Either.isLeft(zero));
    ok(Either.isLeft(negative));
    if (Either.isLeft(zero)) ok(zero.left instanceof WalletInvalidAmount);
    if (Either.isLeft(negative)) ok(negative.left instanceof WalletInvalidAmount);
  });

  it("rejects a debit from a freshly-created wallet (balance is 0)", () => {
    const result = Wallet.debit(fresh(), { amount: 1, now: later });
    ok(Either.isLeft(result));
    if (Either.isLeft(result)) ok(result.left instanceof WalletInsufficientFunds);
  });
});

describe("Wallet aggregate purity", () => {
  it("credit/debit return new wallet instances without mutating the input", () => {
    const wallet = fresh();
    const before = wallet.balance;
    Wallet.credit(wallet, { amount: 50, now: later });
    Wallet.debit(wallet, { amount: 10, now: later });
    deepStrictEqual(wallet.balance, before);
  });
});
