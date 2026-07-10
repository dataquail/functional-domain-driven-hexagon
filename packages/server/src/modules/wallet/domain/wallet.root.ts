import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletId } from "./wallet.id.js";

// Aggregate root data — a dumb value (ADR-0003). Operations live in
// `wallet.root-ops.ts` (`WalletRootOps`) and carry the test obligation.
export class WalletRoot extends Schema.Class<WalletRoot>("WalletRoot")({
  id: WalletId,
  organizationId: OrganizationId,
  balance: Schema.Number,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}
