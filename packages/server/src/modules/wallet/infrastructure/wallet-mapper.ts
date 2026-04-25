import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import { UserId } from "../domain/user-id.js";
import { WalletId } from "../domain/wallet-id.js";
import { Wallet } from "../domain/wallet.js";

type Row = RowSchemas.WalletRow;

export const toDomain = (row: Row): Wallet =>
  new Wallet({
    id: WalletId.make(row.id),
    userId: UserId.make(row.user_id),
    balance: row.balance,
    createdAt: DateTime.unsafeMake(row.created_at),
    updatedAt: DateTime.unsafeMake(row.updated_at),
  });

export type PersistenceRow = {
  readonly id: string;
  readonly user_id: string;
  readonly balance: number;
  readonly created_at: Date;
  readonly updated_at: Date;
};

export const toPersistence = (wallet: Wallet): PersistenceRow => ({
  id: wallet.id,
  user_id: wallet.userId,
  balance: wallet.balance,
  created_at: DateTime.toDate(wallet.createdAt),
  updated_at: DateTime.toDate(wallet.updatedAt),
});
