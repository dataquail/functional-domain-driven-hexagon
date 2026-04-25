import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import { type UserId } from "../domain/user-id.js";
import { WalletAlreadyExistsForUser } from "../domain/wallet-errors.js";
import { type WalletId } from "../domain/wallet-id.js";
import { WalletRepository } from "../domain/wallet-repository.js";
import { type Wallet } from "../domain/wallet.js";

const findByUserIdIn = (
  store: HashMap.HashMap<WalletId, Wallet>,
  userId: UserId,
): Option.Option<Wallet> => {
  for (const wallet of HashMap.values(store)) {
    if (wallet.userId === userId) return Option.some(wallet);
  }
  return Option.none();
};

export const WalletRepositoryFake = Layer.effect(
  WalletRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<WalletId, Wallet>());

    const insert = (wallet: Wallet): Effect.Effect<void, WalletAlreadyExistsForUser> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.isSome(findByUserIdIn(m, wallet.userId))
          ? Effect.fail(new WalletAlreadyExistsForUser({ userId: wallet.userId }))
          : Ref.update(store, HashMap.set(wallet.id, wallet)),
      );

    const findByUserId = (userId: UserId): Effect.Effect<Option.Option<Wallet>> =>
      Effect.map(Ref.get(store), (m) => findByUserIdIn(m, userId));

    return WalletRepository.of({ insert, findByUserId });
  }),
);
