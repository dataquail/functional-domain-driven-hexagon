import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";

import {
  type BillingGatewayUnavailable,
  type InvalidWebhookSignature,
} from "@/modules/billing/domain/subscription/subscription.errors.js";
import { type StripeWebhookEvent } from "@/modules/billing/domain/webhook-event/stripe-webhook.value-object.js";
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

export class BillingGateway extends Context.Service<BillingGateway, BillingGatewayShape>()(
  "BillingGateway",
) {}
