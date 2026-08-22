// Per-feature MSW handler builders for the Billing contract. Tests
// compose these per-scenario via `server.use(...)`. No shared state;
// each handler returns exactly what the test asks for.

import * as BillingContract from "@org/contracts/api/BillingContract";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";

import { BILLING_ORG_ID, makeSubscription } from "../fixtures/billing";
import { getEndpoint, typedHandler } from "../typed-handler";

const currentEndpoint = getEndpoint(BillingContract.PrivateGroup, "getCurrentSubscription");
const startEndpoint = getEndpoint(BillingContract.PrivateGroup, "startSubscription");
const cancelEndpoint = getEndpoint(BillingContract.PrivateGroup, "cancelSubscription");

const notFound = () =>
  Effect.fail(
    new BillingContract.SubscriptionNotFoundError({
      organizationId: BILLING_ORG_ID,
      message: "No subscription for this organization.",
    }),
  );

export const billingHandlers = {
  /** GET current — pass `null` for the "never subscribed" 404. */
  current: (subscription: BillingContract.SubscriptionResponse | null = makeSubscription()) =>
    typedHandler(currentEndpoint, () =>
      subscription === null ? notFound() : Effect.succeed(subscription),
    ),

  start: (
    outcome: { readonly result: "success" | "BadGateway" | "SubscriptionAlreadyExistsError" } = {
      result: "success",
    },
  ) =>
    typedHandler(startEndpoint, () => {
      if (outcome.result === "BadGateway") {
        return Effect.fail(
          new CustomHttpApiError.BadGateway({ message: "Stripe is unreachable." }),
        );
      }
      if (outcome.result === "SubscriptionAlreadyExistsError") {
        return Effect.fail(
          new BillingContract.SubscriptionAlreadyExistsError({
            organizationId: BILLING_ORG_ID,
            message: "This organization already has a subscription.",
          }),
        );
      }
      return Effect.succeed(makeSubscription());
    }),

  cancel: (
    outcome: { readonly result: "success" | "SubscriptionNotFoundError" } = { result: "success" },
  ) =>
    typedHandler(cancelEndpoint, () =>
      outcome.result === "success"
        ? Effect.succeed(makeSubscription({ status: "canceled" }))
        : notFound(),
    ),
};
