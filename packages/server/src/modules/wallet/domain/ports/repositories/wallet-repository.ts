import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type Wallet } from "@/modules/wallet/domain/wallet.aggregate.js";
import { type WalletAlreadyExistsForUser } from "@/modules/wallet/domain/wallet-errors.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

export type WalletRepositoryShape = {
  readonly insert: (
    wallet: Wallet,
  ) => Effect.Effect<void, WalletAlreadyExistsForUser | PersistenceUnavailable>;
  readonly findByUserId: (
    userId: UserId,
  ) => Effect.Effect<Option.Option<Wallet>, PersistenceUnavailable>;
};

export class WalletRepository extends Context.Tag("WalletRepository")<
  WalletRepository,
  WalletRepositoryShape
>() {}
