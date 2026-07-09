import { BillingContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";

import { StartSubscriptionCommand } from "@/modules/billing/commands/start-subscription.command.js";
import { BillingResource } from "@/modules/billing/policies/billing.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// `Actions.Update` covers subscribe + cancel (CRUD vocabulary; the
// verb-level difference is the HTTP method). Gated by
// `IsBillingOrgAdmin` (composed with `SuperAdminOnly`).
export const startSubscriptionEndpoint = Effect.fn("BillingLive.startSubscription")(
  function* (request: EndpointRequest<typeof BillingContract.PrivateGroup, "startSubscription">) {
    // The billing resolver is a deliberate echo of the path orgId —
    // never NotFound — so the contract surface stays narrow.
    yield* Authz.hasPermissions(BillingResource, Actions.Update, request.params.orgId).pipe(
      Effect.catchTag("NotFound", () =>
        Effect.die("Unreachable: billing resolver cannot surface NotFound"),
      ),
    );
    const commandBus = yield* CommandBus;
    const subscription = yield* commandBus.execute(
      StartSubscriptionCommand.make({ organizationId: request.params.orgId }),
    );
    return new BillingContract.SubscriptionResponse({
      id: subscription.id,
      organizationId: subscription.organizationId,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
  },
  Effect.catchTag("SubscriptionAlreadyExistsForOrganization", (err) =>
    Effect.fail(
      new BillingContract.SubscriptionAlreadyExistsError({
        organizationId: err.organizationId,
        message: `An active subscription already exists for organization ${err.organizationId}`,
      }),
    ),
  ),
  Effect.catchTag("BillingGatewayUnavailable", (err) =>
    Effect.fail(new CustomHttpApiError.BadGateway({ message: err.message })),
  ),
  recoverPersistenceUnavailable,
);
