import { BillingContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";

import { CancelSubscriptionCommand } from "@/modules/billing/commands/cancel-subscription.command.js";
import { BillingResource } from "@/modules/billing/policies/billing.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const cancelSubscriptionEndpoint = Effect.fn("BillingLive.cancelSubscription")(
  function* (request: EndpointRequest<typeof BillingContract.PrivateGroup, "cancelSubscription">) {
    yield* Authz.hasPermissions(BillingResource, Actions.Update, request.params.orgId).pipe(
      Effect.catchTag("NotFound", () =>
        Effect.die("Unreachable: billing resolver cannot surface NotFound"),
      ),
    );
    const commandBus = yield* CommandBus;
    const subscription = yield* commandBus.execute(
      CancelSubscriptionCommand.make({ organizationId: request.params.orgId }),
    );
    return new BillingContract.SubscriptionResponse({
      id: subscription.id,
      organizationId: subscription.organizationId,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
  },
  Effect.catchTag("SubscriptionNotFound", (err) =>
    Effect.fail(
      new BillingContract.SubscriptionNotFoundError({
        organizationId: err.organizationId,
        message: `No subscription found for organization ${err.organizationId}`,
      }),
    ),
  ),
  Effect.catchTag("BillingGatewayUnavailable", (err) =>
    Effect.fail(new CustomHttpApiError.BadGateway({ message: err.message })),
  ),
  recoverPersistenceUnavailable,
);
