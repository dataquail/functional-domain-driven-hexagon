import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription/subscription.errors.js";
import { type SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.js";
import { type SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

const findByOrgIn = (
  store: HashMap.HashMap<SubscriptionId, SubscriptionRoot>,
  organizationId: OrganizationId,
): Option.Option<SubscriptionRoot> => {
  for (const sub of HashMap.values(store)) {
    if (sub.organizationId === organizationId) return Option.some(sub);
  }
  return Option.none();
};

export const SubscriptionRepositoryFake = Layer.effect(
  SubscriptionRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<SubscriptionId, SubscriptionRoot>());

    const insertOne = (
      sub: SubscriptionRoot,
    ): Effect.Effect<void, SubscriptionAlreadyExistsForOrganization> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.isSome(findByOrgIn(m, sub.organizationId))
          ? Effect.fail(
              new SubscriptionAlreadyExistsForOrganization({
                organizationId: sub.organizationId,
              }),
            )
          : Ref.update(store, HashMap.set(sub.id, sub)),
      );

    const updateOne = (sub: SubscriptionRoot): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(sub.id, sub));

    // The spec IS the in-memory predicate — the same object the live repo
    // compiles to SQL — so fake and live agree by construction.
    const findOne = (
      spec: Specification<SubscriptionRoot>,
    ): Effect.Effect<SubscriptionRoot | null> =>
      Effect.map(Ref.get(store), (m) => Array.from(HashMap.values(m)).find(spec) ?? null);

    return SubscriptionRepository.of({
      insertOne,
      updateOne,
      findOne,
    });
  }),
);
