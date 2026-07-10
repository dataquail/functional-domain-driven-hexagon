import type * as DateTime from "effect/DateTime";
import * as Result from "effect/Result";

import { type OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletInsufficientFunds, WalletInvalidAmount } from "./wallet.errors.js";
import { WalletCreated, WalletCredited, WalletDebited, type WalletEvent } from "./wallet.events.js";
import { type WalletId } from "./wallet.id.js";
import { WalletRoot } from "./wallet.root.js";

export type Outcome = {
  readonly wallet: WalletRoot;
  readonly events: ReadonlyArray<WalletEvent>;
};

export type CreateInput = {
  readonly id: WalletId;
  readonly organizationId: OrganizationId;
  readonly now: DateTime.Utc;
};

const create = (input: CreateInput): Outcome => {
  const wallet = WalletRoot.make({
    id: input.id,
    organizationId: input.organizationId,
    balance: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
  return {
    wallet,
    events: [WalletCreated.make({ walletId: wallet.id, organizationId: wallet.organizationId })],
  };
};

export type AmountInput = {
  readonly amount: number;
  readonly now: DateTime.Utc;
};

// Aggregate-protected invariant: a wallet's balance never goes negative
// and amounts must be positive. Returned as Result so the use case (and
// tests) can reason about the failure without an Effect runtime; the
// command handler lifts to Effect via Effect.fromResult.
const credit = (
  wallet: WalletRoot,
  input: AmountInput,
): Result.Result<Outcome, WalletInvalidAmount> => {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return Result.fail(new WalletInvalidAmount({ walletId: wallet.id, amount: input.amount }));
  }
  const newBalance = wallet.balance + input.amount;
  const updated = WalletRoot.make({
    id: wallet.id,
    organizationId: wallet.organizationId,
    balance: newBalance,
    createdAt: wallet.createdAt,
    updatedAt: input.now,
  });
  return Result.succeed({
    wallet: updated,
    events: [
      WalletCredited.make({
        walletId: wallet.id,
        amount: input.amount,
        newBalance,
      }),
    ],
  });
};

const debit = (
  wallet: WalletRoot,
  input: AmountInput,
): Result.Result<Outcome, WalletInvalidAmount | WalletInsufficientFunds> => {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return Result.fail(new WalletInvalidAmount({ walletId: wallet.id, amount: input.amount }));
  }
  if (input.amount > wallet.balance) {
    return Result.fail(
      new WalletInsufficientFunds({
        walletId: wallet.id,
        balance: wallet.balance,
        attemptedDebit: input.amount,
      }),
    );
  }
  const newBalance = wallet.balance - input.amount;
  const updated = WalletRoot.make({
    id: wallet.id,
    organizationId: wallet.organizationId,
    balance: newBalance,
    createdAt: wallet.createdAt,
    updatedAt: input.now,
  });
  return Result.succeed({
    wallet: updated,
    events: [
      WalletDebited.make({
        walletId: wallet.id,
        amount: input.amount,
        newBalance,
      }),
    ],
  });
};

export const WalletRootOps = { create, credit, debit } as const;
