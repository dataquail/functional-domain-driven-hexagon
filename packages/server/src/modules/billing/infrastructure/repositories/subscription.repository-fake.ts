import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { type Specification } from "@/globals/application/ddd/specification.ts";
import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription/subscription.errors.ts";
import { type SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.ts";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.ts";
import { type SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.ts";

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
        Option.match(findByOrgIn(m, sub.organizationId), {
          onNone: () => Ref.update(store, HashMap.set(sub.id, sub)),
          onSome: () =>
            Effect.fail(
              new SubscriptionAlreadyExistsForOrganization({ organizationId: sub.organizationId }),
            ),
        }),
      );

    const updateOne = (sub: SubscriptionRoot): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(sub.id, sub));

    // The spec IS the in-memory predicate — the same object the live repo
    // compiles to SQL — so fake and live agree by construction.
    const findOne = (
      spec: Specification<SubscriptionRoot>,
    ): Effect.Effect<Option.Option<SubscriptionRoot>> =>
      Effect.map(Ref.get(store), (m) => Arr.findFirst(HashMap.values(m), spec));

    return SubscriptionRepository.of({
      insertOne,
      updateOne,
      findOne,
    });
  }),
);
