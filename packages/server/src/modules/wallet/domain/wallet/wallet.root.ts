import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";

import { WalletId } from "./wallet.id";

// Aggregate root data — a dumb value (ADR-0003). Operations live in
// `wallet.root-ops.ts` (`WalletRootOps`) and carry the test obligation.
export class WalletRoot extends Schema.Class<WalletRoot, { readonly brand: "WalletRoot" }>(
  "WalletRoot",
)({
  id: WalletId,
  organizationId: OrganizationId,
  balance: Schema.Finite,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}
