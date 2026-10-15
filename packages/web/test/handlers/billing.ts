// Per-feature MSW handler builders for the Billing contract. Tests
// compose these per-scenario via `server.use(...)`. No shared state;
// each handler returns exactly what the test asks for.

import * as BillingContract from "@org/contracts/api/BillingContract";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { BILLING_ORG_ID, makeSubscription } from "@/test/fixtures/billing";
import { getEndpoint, typedHandler } from "@/test/typed-handler";

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
  /** GET current — pass `Option.none()` for the "never subscribed" 404. */
  current: (
    subscription: Option.Option<BillingContract.SubscriptionResponse> = Option.some(
      makeSubscription(),
    ),
  ) =>
    typedHandler(currentEndpoint, () =>
      Option.match(subscription, { onNone: notFound, onSome: (found) => Effect.succeed(found) }),
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
    typedHandler(cancelEndpoint, () => {
      if (outcome.result === "success") {
        return Effect.succeed(makeSubscription({ status: "canceled" }));
      }

      return notFound();
    }),
};
