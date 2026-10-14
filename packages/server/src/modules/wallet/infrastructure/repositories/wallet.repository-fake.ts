import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { type Specification } from "@/globals/application/ddd/specification.js";
import { WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet/wallet.errors.js";
import { type WalletId } from "@/modules/wallet/domain/wallet/wallet.id.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository.js";
import { type WalletRoot } from "@/modules/wallet/domain/wallet/wallet.root.js";

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
        Option.match(findByOrganizationIdIn(m, wallet.organizationId), {
          onNone: () => Ref.update(store, HashMap.set(wallet.id, wallet)),
          onSome: () =>
            Effect.fail(
              new WalletAlreadyExistsForOrganization({ organizationId: wallet.organizationId }),
            ),
        }),
      );

    const findOne = (spec: Specification<WalletRoot>): Effect.Effect<Option.Option<WalletRoot>> =>
      Effect.map(Ref.get(store), (m) => Arr.findFirst(HashMap.values(m), spec));

    return WalletRepository.of({ insertOne, findOne });
  }),
);
