import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { Wallet } from "../domain/wallet.aggregate.js";
import { WalletId } from "../domain/wallet-id.js";

type Row = RowSchemas.WalletRow;

export const toDomain = (row: Row): Wallet =>
  new Wallet({
    id: WalletId.make(row.id),
    organizationId: OrganizationId.make(row.organization_id),
    balance: row.balance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export type PersistenceRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly balance: number;
  readonly created_at: Date;
  readonly updated_at: Date;
};

export const toPersistence = (wallet: Wallet): PersistenceRow => ({
  id: wallet.id,
  organization_id: wallet.organizationId,
  balance: wallet.balance,
  created_at: DateTime.toDate(wallet.createdAt),
  updated_at: DateTime.toDate(wallet.updatedAt),
});
