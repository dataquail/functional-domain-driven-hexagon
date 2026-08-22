// Billing, as the Model sees it: one read and two writes, all org-scoped.
//
// "No subscription yet" arrives from the server as a 404. That is a state the
// panel renders, not a failure it reports, so the absence is folded into `null`
// here -- once, in the Model -- rather than in each consumer. The raw atom stays
// exported because hydration keys on it: only the atom the endpoint built
// carries the serialization metadata a prefetch can encode into.

import { BillingContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ApiClient } from "@/services/api-client.shared";
import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";

export type CurrentSubscription = BillingContract.SubscriptionResponse | null;

const billingRequest = (orgId: OrganizationId) => ({ params: { orgId } });

export const rawSubscriptionQueryAtom = (orgId: OrganizationId) =>
  ApiAtoms.query("billing", "getCurrentSubscription", {
    ...billingRequest(orgId),
    reactivityKeys: ReactivityKeys.billing,
    serializationKey: orgId,
  });

export const fetchRawSubscription = (orgId: OrganizationId) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.billing.getCurrentSubscription(billingRequest(orgId)),
  );

const isSubscriptionMissing = (cause: Cause.Cause<unknown>): boolean =>
  Option.match(Cause.findErrorOption(cause), {
    onNone: () => false,
    onSome: (error) =>
      typeof error === "object" &&
      error !== null &&
      "_tag" in error &&
      error._tag === "SubscriptionNotFoundError",
  });

export const subscriptionQueryAtom = Atom.family((orgId: OrganizationId) =>
  Atom.make((get): AsyncResult.AsyncResult<CurrentSubscription, unknown> => {
    const result = get(rawSubscriptionQueryAtom(orgId));
    if (AsyncResult.isFailure(result) && isSubscriptionMissing(result.cause)) {
      return AsyncResult.success<CurrentSubscription>(null);
    }
    return result;
  }),
);

export const startSubscriptionAtom = ApiAtoms.mutation("billing", "startSubscription");
export const cancelSubscriptionAtom = ApiAtoms.mutation("billing", "cancelSubscription");

export const makeStartSubscriptionPayload = (): BillingContract.StartSubscriptionPayload =>
  new BillingContract.StartSubscriptionPayload({});
