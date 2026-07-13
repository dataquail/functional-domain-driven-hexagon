import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet/wallet.errors.js";
import { type WalletId } from "@/modules/wallet/domain/wallet/wallet.id.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository.js";
import { type WalletRoot } from "@/modules/wallet/domain/wallet/wallet.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
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

    const findOne = (spec: Specification<WalletRoot>): Effect.Effect<WalletRoot | null> =>
      Effect.map(Ref.get(store), (m) => Array.from(HashMap.values(m)).find(spec) ?? null);

    return WalletRepository.of({ insertOne, findOne });
  }),
);
