import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable.js";
import { type Specification } from "@/globals/application/ddd/specification.js";
import { type WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet/wallet.errors.js";
import { type WalletRoot } from "@/modules/wallet/domain/wallet/wallet.root.js";

// Dumb persistence, collapsed to the minimal vocabulary: insert the aggregate,
// and read it back by a Specification. The org's wallet is looked up as a spec
// at the call site (see WalletSpecifications.forOrganization) and compiled to a
// WHERE fragment by the live repository. Absence is `None`. `insertOne`
// keeps its `WalletAlreadyExistsForOrganization` channel: the unique index on
// organization_id is the idempotency guard the create handler swallows.
export type WalletRepositoryService = {
  readonly insertOne: (
    wallet: WalletRoot,
  ) => Effect.Effect<void, WalletAlreadyExistsForOrganization | PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<WalletRoot>,
  ) => Effect.Effect<Option.Option<WalletRoot>, PersistenceUnavailable>;
};

export class WalletRepository extends Context.Service<WalletRepository, WalletRepositoryService>()(
  "WalletRepository",
) {}
