import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet.errors.js";
import { type WalletRoot } from "@/modules/wallet/domain/wallet.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

export type WalletRepositoryShape = {
  readonly insertOne: (
    wallet: WalletRoot,
  ) => Effect.Effect<void, WalletAlreadyExistsForOrganization | PersistenceUnavailable>;
  readonly findOneByOrganizationId: (
    organizationId: OrganizationId,
  ) => Effect.Effect<Option.Option<WalletRoot>, PersistenceUnavailable>;
};

export class WalletRepository extends Context.Service<WalletRepository, WalletRepositoryShape>()(
  "WalletRepository",
) {}
