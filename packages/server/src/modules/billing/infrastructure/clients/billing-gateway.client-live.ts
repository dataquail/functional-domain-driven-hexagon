import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import Stripe from "stripe";

import { EnvVars } from "@/globals/infrastructure/config/env-vars.ts";
import {
  BillingGateway,
  type CancelSubscriptionInput,
  type CancelSubscriptionResult,
  type CreateCustomerInput,
  type CreateCustomerResult,
  type CreateSubscriptionInput,
  type SubscriptionState,
  type VerifyWebhookInput,
} from "@/modules/billing/domain/ports/clients/billing-gateway.client.ts";
import {
  BillingGatewayUnavailable,
  InvalidWebhookSignature,
} from "@/modules/billing/domain/subscription/subscription.errors.ts";
import { type StripeWebhookEvent } from "@/modules/billing/domain/webhook-event/stripe-webhook.value-object.ts";

// Wraps the Stripe SDK. The only file in the repo that imports `stripe`.
// All other billing code consumes the `BillingGateway` Tag and never
// learns Stripe's type names.

// Stripe SDK v22+ removed `current_period_end` from the top-level
// Subscription type — it now lives on each `items.data[i]`. The wire
// shape still carries it on the parent for older API versions, so the
// period end is parsed from the parent first, then the first item.
const OptionalEpoch = Schema.optional(Schema.NullOr(Schema.Finite));

const SubscriptionPeriodWire = Schema.Struct({
  current_period_end: OptionalEpoch,
  items: Schema.optional(
    Schema.Struct({
      data: Schema.optional(Schema.Array(Schema.Struct({ current_period_end: OptionalEpoch }))),
    }),
  ),
});

const decodeSubscriptionPeriod = Schema.decodeUnknownOption(SubscriptionPeriodWire);

const readPeriodEnd = (sub: Stripe.Subscription): Option.Option<DateTime.Utc> =>
  Option.flatMap(decodeSubscriptionPeriod(sub), (wire) =>
    Option.fromNullishOr(wire.current_period_end).pipe(
      Option.orElse(() => Option.fromNullishOr(wire.items?.data?.[0]?.current_period_end)),
    ),
  ).pipe(Option.map((epoch) => DateTime.makeUnsafe(epoch * 1000)));

// Stripe types `invoice.subscription` as string | Subscription | null
// depending on expansion. We only ever need the id.
const InvoiceSubscriptionWire = Schema.Struct({ subscription: Schema.String });

const decodeInvoiceSubscription = Schema.decodeUnknownOption(InvoiceSubscriptionWire);

const toDomainSubscriptionState = (sub: Stripe.Subscription): SubscriptionState => ({
  stripeSubscriptionId: sub.id,
  status: sub.status,
  currentPeriodEnd: readPeriodEnd(sub),
});

const toDomainStripeEvent = (event: Stripe.Event): StripeWebhookEvent => {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return {
        eventId: event.id,
        type: event.type,
        subscription: toDomainSubscriptionState(event.data.object),
      };

    case "invoice.paid":
    case "invoice.payment_failed":
      return {
        eventId: event.id,
        type: event.type,
        invoice: {
          stripeSubscriptionId: Option.map(
            decodeInvoiceSubscription(event.data.object),
            (invoice) => invoice.subscription,
          ),
        },
      };

    default:
      return { eventId: event.id, type: "unknown" };
  }
};

// Stripe's own default, written out because the SDK takes it positionally
// before the crypto provider.
const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300;

const customerParams = (input: CreateCustomerInput): Stripe.CustomerCreateParams => {
  const metadata = { organization_id: input.organizationId };

  return Option.match(Option.fromUndefinedOr(input.email), {
    onNone: () => ({ metadata }),
    onSome: (email) => ({ metadata, email }),
  });
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
      httpClient: Stripe.createFetchHttpClient(),
    });

    // workerd has no synchronous HMAC, so verification goes through SubtleCrypto.
    const cryptoProvider = Stripe.createSubtleCryptoProvider();
    const webhookSecret = Redacted.value(env.STRIPE_WEBHOOK_SECRET);
    const priceId = env.STRIPE_PRICE_ID_DEFAULT;

    const createCustomer = (
      input: CreateCustomerInput,
    ): Effect.Effect<CreateCustomerResult, BillingGatewayUnavailable> =>
      Effect.tryPromise({
        try: () => stripe.customers.create(customerParams(input)),
        catch: (cause) =>
          new BillingGatewayUnavailable({
            message: `Stripe customer create failed: ${String(cause)}`,
          }),
      }).pipe(
        Effect.map((customer) => ({ stripeCustomerId: customer.id })),
        Effect.withSpan("BillingGateway.createCustomer"),
      );

    const createSubscription = (
      input: CreateSubscriptionInput,
    ): Effect.Effect<SubscriptionState, BillingGatewayUnavailable> =>
      Effect.tryPromise({
        try: () =>
          stripe.subscriptions.create({
            customer: input.stripeCustomerId,
            items: [{ price: priceId }],
          }),
        catch: (cause) =>
          new BillingGatewayUnavailable({
            message: `Stripe subscription create failed: ${String(cause)}`,
          }),
      }).pipe(
        Effect.map(toDomainSubscriptionState),
        Effect.withSpan("BillingGateway.createSubscription"),
      );

    const cancelSubscription = (
      input: CancelSubscriptionInput,
    ): Effect.Effect<CancelSubscriptionResult, BillingGatewayUnavailable> =>
      Effect.tryPromise({
        try: () => stripe.subscriptions.cancel(input.stripeSubscriptionId),
        catch: (cause) =>
          new BillingGatewayUnavailable({
            message: `Stripe subscription cancel failed: ${String(cause)}`,
          }),
      }).pipe(
        Effect.map((sub) => {
          const state = toDomainSubscriptionState(sub);

          return { status: state.status, currentPeriodEnd: state.currentPeriodEnd };
        }),
        Effect.withSpan("BillingGateway.cancelSubscription"),
      );

    const verifyAndParseWebhook = (
      input: VerifyWebhookInput,
    ): Effect.Effect<StripeWebhookEvent, InvalidWebhookSignature> =>
      // The signature covers the exact raw payload bytes, so the endpoint
      // passes HttpServerRequest.text through untouched.
      Effect.tryPromise({
        try: () =>
          stripe.webhooks.constructEventAsync(
            input.payload,
            input.signature,
            webhookSecret,
            DEFAULT_SIGNATURE_TOLERANCE_SECONDS,
            cryptoProvider,
          ),
        catch: (cause) =>
          new InvalidWebhookSignature({
            message: `Stripe webhook signature verification failed: ${String(cause)}`,
          }),
      }).pipe(
        Effect.map(toDomainStripeEvent),
        Effect.withSpan("BillingGateway.verifyAndParseWebhook"),
      );

    return BillingGateway.of({
      createCustomer,
      createSubscription,
      cancelSubscription,
      verifyAndParseWebhook,
    });
  }),
);
