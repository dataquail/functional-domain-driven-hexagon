import type * as DateTime from "effect/DateTime";
import * as Either from "effect/Either";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletInsufficientFunds, WalletInvalidAmount } from "./wallet-errors.js";
import { WalletCreated, WalletCredited, WalletDebited, type WalletEvent } from "./wallet-events.js";
import { WalletId } from "./wallet-id.js";

export class Wallet extends Schema.Class<Wallet>("Wallet")({
  id: WalletId,
  organizationId: OrganizationId,
  balance: Schema.Number,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}

export type Result = {
  readonly wallet: Wallet;
  readonly events: ReadonlyArray<WalletEvent>;
};

export type CreateInput = {
  readonly id: WalletId;
  readonly organizationId: OrganizationId;
  readonly now: DateTime.Utc;
};

export const create = (input: CreateInput): Result => {
  const wallet = Wallet.make({
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
// and amounts must be positive. Returned as Either so the use case (and
// tests) can reason about the failure without an Effect runtime; the
// command handler lifts to Effect via Effect.fromEither.
export const credit = (
  wallet: Wallet,
  input: AmountInput,
): Either.Either<Result, WalletInvalidAmount> => {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return Either.left(new WalletInvalidAmount({ walletId: wallet.id, amount: input.amount }));
  }
  const newBalance = wallet.balance + input.amount;
  const updated = Wallet.make({
    id: wallet.id,
    organizationId: wallet.organizationId,
    balance: newBalance,
    createdAt: wallet.createdAt,
    updatedAt: input.now,
  });
  return Either.right({
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

export const debit = (
  wallet: Wallet,
  input: AmountInput,
): Either.Either<Result, WalletInvalidAmount | WalletInsufficientFunds> => {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return Either.left(new WalletInvalidAmount({ walletId: wallet.id, amount: input.amount }));
  }
  if (input.amount > wallet.balance) {
    return Either.left(
      new WalletInsufficientFunds({
        walletId: wallet.id,
        balance: wallet.balance,
        attemptedDebit: input.amount,
      }),
    );
  }
  const newBalance = wallet.balance - input.amount;
  const updated = Wallet.make({
    id: wallet.id,
    organizationId: wallet.organizationId,
    balance: newBalance,
    createdAt: wallet.createdAt,
    updatedAt: input.now,
  });
  return Either.right({
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
