import type { DbSchema } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import { UserId } from "../domain/user-id.js";
import { WalletId } from "../domain/wallet-id.js";
import { Wallet } from "../domain/wallet.js";

type Row = typeof DbSchema.walletsTable.$inferSelect;
type InsertRow = typeof DbSchema.walletsTable.$inferInsert;

export const toDomain = (row: Row): Wallet =>
  new Wallet({
    id: WalletId.make(row.id),
    userId: UserId.make(row.userId),
    balance: row.balance,
    createdAt: DateTime.unsafeMake(row.createdAt),
    updatedAt: DateTime.unsafeMake(row.updatedAt),
  });

export const toPersistence = (wallet: Wallet): InsertRow => ({
  id: wallet.id,
  userId: wallet.userId,
  balance: wallet.balance,
  createdAt: DateTime.toDate(wallet.createdAt),
  updatedAt: DateTime.toDate(wallet.updatedAt),
});
