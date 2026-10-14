import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import {
  WalletInsufficientFunds,
  WalletInvalidAmount,
} from "@/modules/wallet/domain/wallet/wallet.errors.ts";
import {
  WalletCreated,
  WalletCredited,
  WalletDebited,
  type WalletEvent,
} from "@/modules/wallet/domain/wallet/wallet.events.ts";
import { WalletId } from "@/modules/wallet/domain/wallet/wallet.id.ts";
import { type WalletRoot } from "@/modules/wallet/domain/wallet/wallet.root.ts";
import { WalletRootOps } from "@/modules/wallet/domain/wallet/wallet.root-ops.ts";

const walletId = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");
const later = DateTime.makeUnsafe("2025-02-01T00:00:00Z");

const expectFirstEvent = <S extends Schema.Constraint>(
  events: ReadonlyArray<WalletEvent>,
  schema: S,
): WalletEvent & S["Type"] => Option.getOrThrow(Option.filter(Arr.head(events), Schema.is(schema)));

const failureOf = <A, E>(result: Result.Result<A, E>): E => Result.getOrThrow(Result.flip(result));

const fresh = () => WalletRootOps.create({ id: walletId, organizationId, now }).wallet;

describe("WalletRootOps.create", () => {
  it("constructs a wallet with balance 0 and the given ids/timestamps", () => {
    const { wallet } = WalletRootOps.create({ id: walletId, organizationId, now });
    deepStrictEqual(wallet.id, walletId);
    deepStrictEqual(wallet.organizationId, organizationId);
    deepStrictEqual(wallet.balance, 0);
    deepStrictEqual(wallet.createdAt, now);
    deepStrictEqual(wallet.updatedAt, now);
  });

  it("emits exactly one WalletCreated event carrying the wallet and organization ids", () => {
    const { events } = WalletRootOps.create({ id: walletId, organizationId, now });
    deepStrictEqual(events.length, 1);
    const event = expectFirstEvent(events, WalletCreated.schema);
    deepStrictEqual(event.walletId, walletId);
    deepStrictEqual(event.organizationId, organizationId);
  });
});

describe("WalletRootOps.credit", () => {
  it("increases balance by amount and emits WalletCredited with the new balance", () => {
    const { events, wallet } = Result.getOrThrow(
      WalletRootOps.credit(fresh(), { amount: 100, now: later }),
    );

    deepStrictEqual(wallet.balance, 100);
    deepStrictEqual(wallet.updatedAt, later);
    deepStrictEqual(events.length, 1);
    const event = expectFirstEvent(events, WalletCredited.schema);
    deepStrictEqual(event.amount, 100);
    deepStrictEqual(event.newBalance, 100);
  });

  it("rejects zero or negative amounts (invariant: amount must be positive)", () => {
    const zero = WalletRootOps.credit(fresh(), { amount: 0, now: later });
    const negative = WalletRootOps.credit(fresh(), { amount: -10, now: later });
    ok(Schema.is(WalletInvalidAmount)(failureOf(zero)));
    ok(Schema.is(WalletInvalidAmount)(failureOf(negative)));
  });

  it("rejects non-finite amounts (NaN, Infinity)", () => {
    const nan = WalletRootOps.credit(fresh(), { amount: NaN, now: later });
    const inf = WalletRootOps.credit(fresh(), { amount: Infinity, now: later });
    ok(Result.isFailure(nan));
    ok(Result.isFailure(inf));
  });
});

describe("WalletRootOps.debit", () => {
  const funded = (): WalletRoot =>
    Result.getOrThrow(WalletRootOps.credit(fresh(), { amount: 100, now })).wallet;

  it("decreases balance by amount and emits WalletDebited with the new balance", () => {
    const { events, wallet } = Result.getOrThrow(
      WalletRootOps.debit(funded(), { amount: 30, now: later }),
    );

    deepStrictEqual(wallet.balance, 70);
    deepStrictEqual(wallet.updatedAt, later);
    const event = expectFirstEvent(events, WalletDebited.schema);
    deepStrictEqual(event.amount, 30);
    deepStrictEqual(event.newBalance, 70);
  });

  it("rejects a debit that would overdraft (invariant: balance never goes negative)", () => {
    const failure = failureOf(WalletRootOps.debit(funded(), { amount: 101, now: later }));
    ok(Schema.is(WalletInsufficientFunds)(failure));
    deepStrictEqual(failure.balance, 100);
    deepStrictEqual(failure.attemptedDebit, 101);
  });

  it("allows debiting the exact balance (drains to zero)", () => {
    const { wallet } = Result.getOrThrow(
      WalletRootOps.debit(funded(), { amount: 100, now: later }),
    );

    deepStrictEqual(wallet.balance, 0);
  });

  it("rejects zero or negative amounts (invariant: amount must be positive)", () => {
    const zero = WalletRootOps.debit(funded(), { amount: 0, now: later });
    const negative = WalletRootOps.debit(funded(), { amount: -1, now: later });
    ok(Schema.is(WalletInvalidAmount)(failureOf(zero)));
    ok(Schema.is(WalletInvalidAmount)(failureOf(negative)));
  });

  it("rejects a debit from a freshly-created wallet (balance is 0)", () => {
    const result = WalletRootOps.debit(fresh(), { amount: 1, now: later });
    ok(Schema.is(WalletInsufficientFunds)(failureOf(result)));
  });
});

describe("Wallet aggregate purity", () => {
  it("credit/debit return new wallet instances without mutating the input", () => {
    const wallet = fresh();
    const before = wallet.balance;
    WalletRootOps.credit(wallet, { amount: 50, now: later });
    WalletRootOps.debit(wallet, { amount: 10, now: later });
    deepStrictEqual(wallet.balance, before);
  });
});
