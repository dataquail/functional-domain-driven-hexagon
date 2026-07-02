import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type Subscription } from "@/modules/billing/domain/subscription.aggregate.js";
import { type SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription-errors.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

export type SubscriptionRepositoryShape = {
  readonly insertOne: (
    subscription: Subscription,
  ) => Effect.Effect<void, SubscriptionAlreadyExistsForOrganization | PersistenceUnavailable>;
  readonly updateOne: (subscription: Subscription) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOneByOrganizationId: (
    organizationId: OrganizationId,
  ) => Effect.Effect<Option.Option<Subscription>, PersistenceUnavailable>;
  readonly findOneByStripeSubscriptionId: (
    stripeSubscriptionId: string,
  ) => Effect.Effect<Option.Option<Subscription>, PersistenceUnavailable>;
};

export class SubscriptionRepository extends Context.Tag("SubscriptionRepository")<
  SubscriptionRepository,
  SubscriptionRepositoryShape
>() {}
