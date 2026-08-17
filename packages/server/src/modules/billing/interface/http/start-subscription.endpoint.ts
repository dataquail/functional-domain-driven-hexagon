import { CommandBus } from "@effect-server-utils/cqrs";
import { BillingContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";

import { StartSubscriptionCommand } from "@/modules/billing/commands/start-subscription.command.js";
import { BillingResource } from "@/modules/billing/policies/billing.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// `Actions.Update` covers subscribe + cancel (CRUD vocabulary; the
// verb-level difference is the HTTP method). Gated by
// `IsBillingOrgAdmin` (composed with `SuperAdminOnly`).
export const startSubscriptionEndpoint = Effect.fn("BillingLive.startSubscription")(
  function* (request: EndpointRequest<typeof BillingContract.PrivateGroup, "startSubscription">) {
    yield* Authz.hasPermissions(BillingResource, Actions.Update, request.params.orgId);
    const commandBus = yield* CommandBus;
    const subscription = yield* commandBus.execute(StartSubscriptionCommand, {
      organizationId: request.params.orgId,
    });
    return new BillingContract.SubscriptionResponse({
      id: subscription.id,
      organizationId: subscription.organizationId,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
  },
  Effect.catchTag(
    "SubscriptionAlreadyExistsForOrganization",
    (err) =>
      new BillingContract.SubscriptionAlreadyExistsError({
        organizationId: err.organizationId,
        message: `An active subscription already exists for organization ${err.organizationId}`,
      }),
  ),
  Effect.catchTag(
    "BillingGatewayUnavailable",
    (err) => new CustomHttpApiError.BadGateway({ message: err.message }),
  ),
  recoverPersistenceUnavailable,
);
