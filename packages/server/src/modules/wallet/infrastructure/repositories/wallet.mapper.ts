import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { type ColumnMap } from "@/globals/infrastructure/database/criteria-to-sql.js";
import { WalletId } from "@/modules/wallet/domain/wallet/wallet.id.js";
import { WalletRoot } from "@/modules/wallet/domain/wallet/wallet.root.js";

type Row = RowSchemas.WalletRow;

// Resolves the specification field names the live repository filters on to
// physical columns of wallet.wallets. Only filterable scalar fields need an
// entry; `satisfies` keeps the keys honest against the root.
export const columns = {
  id: "id",
  organizationId: "organization_id",
} as const satisfies Partial<Record<keyof WalletRoot, string>> & ColumnMap;

export const toDomain = (row: Row): WalletRoot =>
  new WalletRoot({
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

export const toPersistence = (wallet: WalletRoot): PersistenceRow => ({
  id: wallet.id,
  organization_id: wallet.organizationId,
  balance: wallet.balance,
  created_at: DateTime.toDate(wallet.createdAt),
  updated_at: DateTime.toDate(wallet.updatedAt),
});
