import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletRepository } from "../domain/ports/repositories/wallet-repository.js";
import { type Wallet } from "../domain/wallet.aggregate.js";
import { WalletAlreadyExistsForOrganization } from "../domain/wallet-errors.js";
import { type WalletId } from "../domain/wallet-id.js";

const findByOrganizationIdIn = (
  store: HashMap.HashMap<WalletId, Wallet>,
  organizationId: OrganizationId,
): Option.Option<Wallet> => {
  for (const wallet of HashMap.values(store)) {
    if (wallet.organizationId === organizationId) return Option.some(wallet);
  }
  return Option.none();
};

export const WalletRepositoryFake = Layer.effect(
  WalletRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<WalletId, Wallet>());

    const insertOne = (wallet: Wallet): Effect.Effect<void, WalletAlreadyExistsForOrganization> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.isSome(findByOrganizationIdIn(m, wallet.organizationId))
          ? Effect.fail(
              new WalletAlreadyExistsForOrganization({ organizationId: wallet.organizationId }),
            )
          : Ref.update(store, HashMap.set(wallet.id, wallet)),
      );

    const findOneByOrganizationId = (
      organizationId: OrganizationId,
    ): Effect.Effect<Option.Option<Wallet>> =>
      Effect.map(Ref.get(store), (m) => findByOrganizationIdIn(m, organizationId));

    return WalletRepository.of({ insertOne, findOneByOrganizationId });
  }),
);
