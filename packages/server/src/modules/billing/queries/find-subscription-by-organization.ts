import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription-repository.js";

import {
  type FindSubscriptionByOrganizationOutput,
  type FindSubscriptionByOrganizationQuery,
} from "./find-subscription-by-organization-query.js";

// Maps the domain `Subscription` aggregate down to the cross-boundary
// `SubscriptionView` shape — clients don't need the Stripe id columns,
// and exposing them needlessly couples consumers to the gateway.
export const findSubscriptionByOrganization = (
  query: FindSubscriptionByOrganizationQuery,
): FindSubscriptionByOrganizationOutput =>
  Effect.gen(function* () {
    const repo = yield* SubscriptionRepository;
    const found = yield* repo.findByOrganizationId(query.organizationId);
    return Option.map(found, (sub) => ({
      id: sub.id,
      organizationId: sub.organizationId,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
    }));
  });
