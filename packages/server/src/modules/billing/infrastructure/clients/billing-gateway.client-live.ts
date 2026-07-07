import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import Stripe from "stripe";

import { EnvVars } from "@/common/env-vars.js";
import {
  BillingGateway,
  type CancelSubscriptionInput,
  type CancelSubscriptionResult,
  type CreateCustomerInput,
  type CreateCustomerResult,
  type CreateSubscriptionInput,
  type StripeWebhookEvent,
  type SubscriptionState,
  type VerifyWebhookInput,
} from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import {
  BillingGatewayUnavailable,
  InvalidWebhookSignature,
} from "@/modules/billing/domain/subscription.errors.js";

// Wraps the Stripe SDK. The only file in the repo that imports `stripe`.
// All other billing code consumes the `BillingGateway` Tag and never
// learns Stripe's type names.

// Stripe SDK v22+ removed `current_period_end` from the top-level
// Subscription type — it now lives on each `items.data[i]`. The wire
// shape still carries it on the parent for older API versions, so we
// read it via an opt-in cast; if absent, we fall back to the first
// item's value, and finally to null.
const readPeriodEnd = (sub: Stripe.Subscription): number | null => {
  const top = (sub as unknown as { current_period_end?: number | null }).current_period_end;
  if (typeof top === "number") return top;
  const items = (
    sub as unknown as { items?: { data?: ReadonlyArray<{ current_period_end?: number | null }> } }
  ).items;
  const first = items?.data?.[0]?.current_period_end;
  return typeof first === "number" ? first : null;
};

const toDomainSubscriptionState = (sub: Stripe.Subscription): SubscriptionState => {
  const epoch = readPeriodEnd(sub);
  return {
    stripeSubscriptionId: sub.id,
    status: sub.status,
    currentPeriodEnd: epoch !== null ? DateTime.unsafeMake(new Date(epoch * 1000)) : null,
  };
};

const toDomainStripeEvent = (event: Stripe.Event): StripeWebhookEvent => {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const epoch = readPeriodEnd(sub);
      return {
        eventId: event.id,
        type: event.type,
        subscription: {
          stripeSubscriptionId: sub.id,
          status: sub.status,
          currentPeriodEnd: epoch !== null ? DateTime.unsafeMake(new Date(epoch * 1000)) : null,
        },
      };
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      // Stripe types `invoice.subscription` as string | Subscription | null
      // depending on expansion. We only ever need the id.
      const subRef = (invoice as unknown as { subscription?: string | null }).subscription;
      return {
        eventId: event.id,
        type: event.type,
        invoice: {
          stripeSubscriptionId: typeof subRef === "string" ? subRef : null,
        },
      };
    }
    default:
      return { eventId: event.id, type: "unknown" };
  }
};

export const BillingGatewayLive = Layer.effect(
  BillingGateway,
  Effect.gen(function* () {
    const env = yield* EnvVars;
    // We deliberately don't pin `apiVersion` — the SDK uses its
    // matching default. Pinning the SDK version (in package.json) is
    // the actual contract here; the Stripe API surface we touch is
    // narrow and stable. If we ever need to upgrade behind a feature
    // flag, plumb `apiVersion` through env.
    const stripe = new Stripe(Redacted.value(env.STRIPE_SECRET_KEY), {
      typescript: true,
    });
    const webhookSecret = Redacted.value(env.STRIPE_WEBHOOK_SECRET);
    const priceId = env.STRIPE_PRICE_ID_DEFAULT;

    const createCustomer = (
      input: CreateCustomerInput,
    ): Effect.Effect<CreateCustomerResult, BillingGatewayUnavailable> =>
      Effect.tryPromise({
        try: async () => {
          const customer = await stripe.customers.create({
            metadata: { organization_id: input.organizationId },
            ...(input.email !== undefined ? { email: input.email } : {}),
          });
          return { stripeCustomerId: customer.id };
        },
        catch: (cause) =>
          new BillingGatewayUnavailable({
            message: `Stripe customer create failed: ${String(cause)}`,
          }),
      }).pipe(Effect.withSpan("BillingGateway.createCustomer"));

    const createSubscription = (
      input: CreateSubscriptionInput,
    ): Effect.Effect<SubscriptionState, BillingGatewayUnavailable> =>
      Effect.tryPromise({
        try: async () => {
          const sub = await stripe.subscriptions.create({
            customer: input.stripeCustomerId,
            items: [{ price: priceId }],
          });
          return toDomainSubscriptionState(sub);
        },
        catch: (cause) =>
          new BillingGatewayUnavailable({
            message: `Stripe subscription create failed: ${String(cause)}`,
          }),
      }).pipe(Effect.withSpan("BillingGateway.createSubscription"));

    const cancelSubscription = (
      input: CancelSubscriptionInput,
    ): Effect.Effect<CancelSubscriptionResult, BillingGatewayUnavailable> =>
      Effect.tryPromise({
        try: async () => {
          const sub = await stripe.subscriptions.cancel(input.stripeSubscriptionId);
          const state = toDomainSubscriptionState(sub);
          return { status: state.status, currentPeriodEnd: state.currentPeriodEnd };
        },
        catch: (cause) =>
          new BillingGatewayUnavailable({
            message: `Stripe subscription cancel failed: ${String(cause)}`,
          }),
      }).pipe(Effect.withSpan("BillingGateway.cancelSubscription"));

    const verifyAndParseWebhook = (
      input: VerifyWebhookInput,
    ): Effect.Effect<StripeWebhookEvent, InvalidWebhookSignature> =>
      Effect.try({
        try: () => {
          // constructEvent requires the EXACT raw payload bytes the
          // signature was computed over. The endpoint reads
          // HttpServerRequest.text — no JSON re-serialization between
          // the wire and here.
          const event = stripe.webhooks.constructEvent(
            input.payload,
            input.signature,
            webhookSecret,
          );
          return toDomainStripeEvent(event);
        },
        catch: (cause) =>
          new InvalidWebhookSignature({
            message: `Stripe webhook signature verification failed: ${String(cause)}`,
          }),
      }).pipe(Effect.withSpan("BillingGateway.verifyAndParseWebhook"));

    return BillingGateway.of({
      createCustomer,
      createSubscription,
      cancelSubscription,
      verifyAndParseWebhook,
    });
  }),
);
