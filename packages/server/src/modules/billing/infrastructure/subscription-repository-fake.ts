import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription-repository.js";
import { type Subscription } from "@/modules/billing/domain/subscription.aggregate.js";
import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription-errors.js";
import { type SubscriptionId } from "@/modules/billing/domain/subscription-id.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

const findByOrgIn = (
  store: HashMap.HashMap<SubscriptionId, Subscription>,
  organizationId: OrganizationId,
): Option.Option<Subscription> => {
  for (const sub of HashMap.values(store)) {
    if (sub.organizationId === organizationId) return Option.some(sub);
  }
  return Option.none();
};

const findByStripeIdIn = (
  store: HashMap.HashMap<SubscriptionId, Subscription>,
  stripeSubscriptionId: string,
): Option.Option<Subscription> => {
  for (const sub of HashMap.values(store)) {
    if (sub.stripeSubscriptionId === stripeSubscriptionId) return Option.some(sub);
  }
  return Option.none();
};

export const SubscriptionRepositoryFake = Layer.effect(
  SubscriptionRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<SubscriptionId, Subscription>());

    const insertOne = (
      sub: Subscription,
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

    const updateOne = (sub: Subscription): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(sub.id, sub));

    const findOneByOrganizationId = (
      organizationId: OrganizationId,
    ): Effect.Effect<Option.Option<Subscription>> =>
      Effect.map(Ref.get(store), (m) => findByOrgIn(m, organizationId));

    const findOneByStripeSubscriptionId = (
      stripeSubscriptionId: string,
    ): Effect.Effect<Option.Option<Subscription>> =>
      Effect.map(Ref.get(store), (m) => findByStripeIdIn(m, stripeSubscriptionId));

    return SubscriptionRepository.of({
      insertOne,
      updateOne,
      findOneByOrganizationId,
      findOneByStripeSubscriptionId,
    });
  }),
);
