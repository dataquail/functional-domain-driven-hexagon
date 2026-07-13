import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription/subscription.errors.js";
import { type SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";

// Dumb persistence, collapsed to the minimal vocabulary: insert/update the
// aggregate, and read it back by a Specification. Identity and natural-key
// lookups — by organization, by Stripe subscription id — are expressed as a
// spec at the call site (see SubscriptionSpecifications) and compiled to a
// WHERE fragment by the live repository. Absence is a plain `null`; mapping it
// to a domain error (SubscriptionNotFound) is the handler's job.
export type SubscriptionRepositoryShape = {
  readonly insertOne: (
    subscription: SubscriptionRoot,
  ) => Effect.Effect<void, SubscriptionAlreadyExistsForOrganization | PersistenceUnavailable>;
  readonly updateOne: (
    subscription: SubscriptionRoot,
  ) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<SubscriptionRoot>,
  ) => Effect.Effect<SubscriptionRoot | null, PersistenceUnavailable>;
};

export class SubscriptionRepository extends Context.Service<
  SubscriptionRepository,
  SubscriptionRepositoryShape
>()("SubscriptionRepository") {}
