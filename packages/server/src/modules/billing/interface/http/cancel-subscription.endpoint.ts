import { CommandBus } from "@effect-server-utils/cqrs";
import { BillingContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";

import { Actions } from "@/globals/application/ports/actions.js";
import * as Authz from "@/globals/infrastructure/auth/authz.js";
import {
  type EndpointRequest,
  recoverPersistenceUnavailable,
} from "@/globals/infrastructure/framework/http/http-endpoint.js";
import { CancelSubscriptionCommand } from "@/modules/billing/commands/cancel-subscription.command.js";
import { BillingResource } from "@/modules/billing/policies/billing.policies.js";

export const cancelSubscriptionEndpoint = Effect.fn("BillingLive.cancelSubscription")(
  function* (request: EndpointRequest<typeof BillingContract.PrivateGroup, "cancelSubscription">) {
    yield* Authz.hasPermissions(BillingResource, Actions.Update, request.params.orgId);
    const commandBus = yield* CommandBus;
    const subscription = yield* commandBus.execute(CancelSubscriptionCommand, {
      organizationId: request.params.orgId,
    });
    return new BillingContract.SubscriptionResponse({
      id: subscription.id,
      organizationId: subscription.organizationId,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
  },
  Effect.catchTags({
    SubscriptionNotFound: (err) =>
      new BillingContract.SubscriptionNotFoundError({
        organizationId: err.organizationId,
        message: `No subscription found for organization ${err.organizationId}`,
      }),
    BillingGatewayUnavailable: (err) => new CustomHttpApiError.BadGateway({ message: err.message }),
  }),
  recoverPersistenceUnavailable,
);
