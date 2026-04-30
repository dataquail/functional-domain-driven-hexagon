import { UserId } from "@/platform/ids/user-id.js";
import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import { WalletCreated, type WalletEvent } from "./wallet-events.js";
import { WalletId } from "./wallet-id.js";

export class Wallet extends Schema.Class<Wallet>("Wallet")({
  id: WalletId,
  userId: UserId,
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
  readonly userId: UserId;
  readonly now: DateTime.Utc;
};

export const create = (input: CreateInput): Result => {
  const wallet = Wallet.make({
    id: input.id,
    userId: input.userId,
    balance: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
  return {
    wallet,
    events: [WalletCreated.make({ walletId: wallet.id, userId: wallet.userId })],
  };
};
