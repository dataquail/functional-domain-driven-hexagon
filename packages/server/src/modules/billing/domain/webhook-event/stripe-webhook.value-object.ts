import * as Schema from "effect/Schema";

// The parsed Stripe webhook the billing domain reacts to — a discriminated
// union over the handful of Stripe event types we model. `type` carries the
// literal string from Stripe; the consumer switches on it. `unknown` is the
// safety bucket for event types we haven't modeled yet (record-and-200 so
// Stripe stops retrying). Produced by the BillingGateway port
// (`verifyAndParseWebhook`) and carried by the `StripeWebhookIngested` event.
export const StripeWebhookEvent = Schema.Union([
  Schema.Struct({
    eventId: Schema.String,
    type: Schema.Literals([
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ]),
    subscription: Schema.Struct({
      stripeSubscriptionId: Schema.String,
      status: Schema.String,
      currentPeriodEnd: Schema.NullOr(Schema.DateTimeUtc),
    }),
  }),
  Schema.Struct({
    eventId: Schema.String,
    type: Schema.Literals(["invoice.paid", "invoice.payment_failed"]),
    invoice: Schema.Struct({
      stripeSubscriptionId: Schema.NullOr(Schema.String),
    }),
  }),
  Schema.Struct({
    eventId: Schema.String,
    type: Schema.Literal("unknown"),
  }),
]);
export type StripeWebhookEvent = typeof StripeWebhookEvent.Type;
