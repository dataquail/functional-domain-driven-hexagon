import { BillingContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { BillingResource } from "@/modules/billing/policies/billing.policies.js";
import { FindSubscriptionByOrganizationQuery } from "@/modules/billing/queries/find-subscription-by-organization.query.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// `Actions.Read` is the member-or-super-admin gate. Subscription
// state is something every member of the org may see — only
// mutation requires admin.
export const getCurrentSubscriptionEndpoint = (
  request: EndpointRequest<typeof BillingContract.PrivateGroup, "getCurrentSubscription">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(BillingResource, Actions.Read, request.params.orgId).pipe(
      Effect.catchTag("NotFound", () =>
        Effect.die("Unreachable: billing resolver cannot surface NotFound"),
      ),
    );
    const queryBus = yield* QueryBus;
    const result = yield* queryBus.execute(
      FindSubscriptionByOrganizationQuery.make({ organizationId: request.params.orgId }),
    );
    if (Option.isNone(result)) {
      return yield* Effect.fail(
        new BillingContract.SubscriptionNotFoundError({
          organizationId: request.params.orgId,
          message: `No subscription found for organization ${request.params.orgId}`,
        }),
      );
    }
    const sub = result.value;
    return new BillingContract.SubscriptionResponse({
      id: sub.id,
      organizationId: sub.organizationId,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
    });
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("BillingLive.getCurrentSubscription"));
