import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type BillingGatewayUnavailable,
  type InvalidWebhookSignature,
} from "@/modules/billing/domain/subscription-errors.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// Outbound port to the external billing provider (Stripe in prod, an
// in-memory simulator in tests). The port stays narrow on purpose: the
// surface here is the set of operations the use cases actually need,
// not Stripe's full SDK. Webhook event variants are likewise the
// subset we care about.

export type CreateCustomerInput = {
  readonly organizationId: OrganizationId;
  readonly email?: string;
};

export type CreateCustomerResult = {
  readonly stripeCustomerId: string;
};

// `priceId` is a gateway-internal concern: the prod gateway reads it
// from `EnvVars.STRIPE_PRICE_ID_DEFAULT`; the fake gateway has no
// pricing model. Keeping it OUT of the port surface keeps commands
// (which can't touch `EnvVars` per the commands-isolation rule)
// gateway-agnostic. When a real product surface introduces multiple
// plans, lift `priceId` into the command + port together.
export type CreateSubscriptionInput = {
  readonly stripeCustomerId: string;
};

export type SubscriptionState = {
  readonly stripeSubscriptionId: string;
  readonly status: string;
  readonly currentPeriodEnd: DateTime.Utc | null;
};

export type CancelSubscriptionInput = {
  readonly stripeSubscriptionId: string;
};

export type CancelSubscriptionResult = {
  readonly status: string;
  readonly currentPeriodEnd: DateTime.Utc | null;
};

export type VerifyWebhookInput = {
  readonly payload: string;
  readonly signature: string;
};

// Discriminated union over the handful of Stripe event types we react
// to. `type` carries the literal string from Stripe; the consumer
// switches on it. `unknown` is the safety bucket for event types we
// haven't modeled yet — we still want to record-and-200 the delivery
// so Stripe doesn't keep retrying.
export const StripeWebhookEvent = Schema.Union(
  Schema.Struct({
    eventId: Schema.String,
    type: Schema.Literal(
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ),
    subscription: Schema.Struct({
      stripeSubscriptionId: Schema.String,
      status: Schema.String,
      currentPeriodEnd: Schema.NullOr(Schema.DateTimeUtc),
    }),
  }),
  Schema.Struct({
    eventId: Schema.String,
    type: Schema.Literal("invoice.paid", "invoice.payment_failed"),
    invoice: Schema.Struct({
      stripeSubscriptionId: Schema.NullOr(Schema.String),
    }),
  }),
  Schema.Struct({
    eventId: Schema.String,
    type: Schema.Literal("unknown"),
  }),
);
export type StripeWebhookEvent = typeof StripeWebhookEvent.Type;

export type BillingGatewayShape = {
  readonly createCustomer: (
    input: CreateCustomerInput,
  ) => Effect.Effect<CreateCustomerResult, BillingGatewayUnavailable>;
  readonly createSubscription: (
    input: CreateSubscriptionInput,
  ) => Effect.Effect<SubscriptionState, BillingGatewayUnavailable>;
  readonly cancelSubscription: (
    input: CancelSubscriptionInput,
  ) => Effect.Effect<CancelSubscriptionResult, BillingGatewayUnavailable>;
  readonly verifyAndParseWebhook: (
    input: VerifyWebhookInput,
  ) => Effect.Effect<StripeWebhookEvent, InvalidWebhookSignature>;
};

export class BillingGateway extends Context.Tag("BillingGateway")<
  BillingGateway,
  BillingGatewayShape
>() {}
