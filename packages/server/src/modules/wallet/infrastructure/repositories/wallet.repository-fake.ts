import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { WalletRepository } from "@/modules/wallet/domain/ports/repositories/wallet.repository.js";
import { WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet.errors.js";
import { type WalletId } from "@/modules/wallet/domain/wallet.id.js";
import { type WalletRoot } from "@/modules/wallet/domain/wallet.root.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

const findByOrganizationIdIn = (
  store: HashMap.HashMap<WalletId, WalletRoot>,
  organizationId: OrganizationId,
): Option.Option<WalletRoot> => {
  for (const wallet of HashMap.values(store)) {
    if (wallet.organizationId === organizationId) return Option.some(wallet);
  }
  return Option.none();
};

export const WalletRepositoryFake = Layer.effect(
  WalletRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<WalletId, WalletRoot>());

    const insertOne = (
      wallet: WalletRoot,
    ): Effect.Effect<void, WalletAlreadyExistsForOrganization> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.isSome(findByOrganizationIdIn(m, wallet.organizationId))
          ? Effect.fail(
              new WalletAlreadyExistsForOrganization({ organizationId: wallet.organizationId }),
            )
          : Ref.update(store, HashMap.set(wallet.id, wallet)),
      );

    const findOneByOrganizationId = (
      organizationId: OrganizationId,
    ): Effect.Effect<Option.Option<WalletRoot>> =>
      Effect.map(Ref.get(store), (m) => findByOrganizationIdIn(m, organizationId));

    return WalletRepository.of({ insertOne, findOneByOrganizationId });
  }),
);
