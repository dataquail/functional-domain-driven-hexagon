import { type UserId } from "@org/contracts/EntityIds";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import { type WalletAlreadyExistsForUser } from "./wallet-errors.js";
import { type Wallet } from "./wallet.js";

export type WalletRepositoryShape = {
  readonly insert: (wallet: Wallet) => Effect.Effect<void, WalletAlreadyExistsForUser>;
  readonly findByUserId: (userId: UserId) => Effect.Effect<Option.Option<Wallet>>;
};

export class WalletRepository extends Context.Tag("WalletRepository")<
  WalletRepository,
  WalletRepositoryShape
>() {}
