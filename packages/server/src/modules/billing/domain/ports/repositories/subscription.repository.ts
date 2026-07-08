import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription.errors.js";
import { type SubscriptionRoot } from "@/modules/billing/domain/subscription.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

export type SubscriptionRepositoryShape = {
  readonly insertOne: (
    subscription: SubscriptionRoot,
  ) => Effect.Effect<void, SubscriptionAlreadyExistsForOrganization | PersistenceUnavailable>;
  readonly updateOne: (
    subscription: SubscriptionRoot,
  ) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOneByOrganizationId: (
    organizationId: OrganizationId,
  ) => Effect.Effect<Option.Option<SubscriptionRoot>, PersistenceUnavailable>;
  readonly findOneByStripeSubscriptionId: (
    stripeSubscriptionId: string,
  ) => Effect.Effect<Option.Option<SubscriptionRoot>, PersistenceUnavailable>;
};

export class SubscriptionRepository extends Context.Service<SubscriptionRepository, SubscriptionRepositoryShape>()("SubscriptionRepository") {}
