import { BillingContract } from "@org/contracts/api/Contracts";
import { QueryBus } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { BillingResource } from "@/modules/billing/policies/billing.policies.js";
import { FindSubscriptionByOrganizationQuery } from "@/modules/billing/queries/find-subscription-by-organization.query.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// `Actions.Read` is the member-or-super-admin gate. Subscription
// state is something every member of the org may see — only
// mutation requires admin.
export const getCurrentSubscriptionEndpoint = Effect.fn("BillingLive.getCurrentSubscription")(
  function* (
    request: EndpointRequest<typeof BillingContract.PrivateGroup, "getCurrentSubscription">,
  ) {
    yield* Authz.hasPermissions(BillingResource, Actions.Read, request.params.orgId);
    const queryBus = yield* QueryBus;
    const result = yield* queryBus.execute(FindSubscriptionByOrganizationQuery, {
      organizationId: request.params.orgId,
    });
    if (result === null) {
      return yield* new BillingContract.SubscriptionNotFoundError({
        organizationId: request.params.orgId,
        message: `No subscription found for organization ${request.params.orgId}`,
      });
    }
    const sub = result;
    return new BillingContract.SubscriptionResponse({
      id: sub.id,
      organizationId: sub.organizationId,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
    });
  },
  recoverPersistenceUnavailable,
);
