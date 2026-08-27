import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

// Syncs the local Subscription projection to a Stripe-reported status.
// Dispatched by the stripe-webhook event adapter (interface/events) for
// subscription lifecycle events — Stripe vocabulary is translated to these
// domain fields in the adapter, so this command carries no Stripe types.
export const SyncSubscriptionCommand = Command.make("SyncSubscriptionCommand", {
  payload: {
    stripeSubscriptionId: Schema.String,
    status: Schema.String,
    currentPeriodEnd: Schema.NullOr(Schema.DateTimeUtc),
  },
  success: Schema.Void,
  failure: PersistenceUnavailable,
});
export type SyncSubscriptionPayload = Command.Payload<typeof SyncSubscriptionCommand>;
