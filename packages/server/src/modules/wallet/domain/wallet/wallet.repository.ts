import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet/wallet.errors.js";
import { type WalletRoot } from "@/modules/wallet/domain/wallet/wallet.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";

// Dumb persistence, collapsed to the minimal vocabulary: insert the aggregate,
// and read it back by a Specification. The org's wallet is looked up as a spec
// at the call site (see WalletSpecifications.forOrganization) and compiled to a
// WHERE fragment by the live repository. Absence is a plain `null`. `insertOne`
// keeps its `WalletAlreadyExistsForOrganization` channel: the unique index on
// organization_id is the idempotency guard the create handler swallows.
export type WalletRepositoryShape = {
  readonly insertOne: (
    wallet: WalletRoot,
  ) => Effect.Effect<void, WalletAlreadyExistsForOrganization | PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<WalletRoot>,
  ) => Effect.Effect<WalletRoot | null, PersistenceUnavailable>;
};

export class WalletRepository extends Context.Service<WalletRepository, WalletRepositoryShape>()(
  "WalletRepository",
) {}
