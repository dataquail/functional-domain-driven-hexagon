import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";

import {
  BillingGateway,
  type CancelSubscriptionInput,
  type CancelSubscriptionResult,
  type CreateCustomerInput,
  type CreateCustomerResult,
  type CreateSubscriptionInput,
  StripeWebhookEvent,
  type SubscriptionState,
  type VerifyWebhookInput,
} from "@/modules/billing/domain/ports/billing-gateway.js";
import { InvalidWebhookSignature } from "@/modules/billing/domain/subscription-errors.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

const decodeWebhookEvent = Schema.decodeUnknown(StripeWebhookEvent);

// In-memory simulator for tests. Mirrors Stripe's state machine at the
// surface we depend on: customers, subscriptions, status transitions.
//
// Tests synthesize webhook payloads by stringifying a known JSON shape
// (the FAKE_SIGNATURE constant) — `verifyAndParseWebhook` accepts that
// signature and parses the JSON; any other signature fails as
// `InvalidWebhookSignature`. This lets the suite cover both the bad-
// signature path and the happy path without real cryptography.

export const FAKE_WEBHOOK_SIGNATURE = "t=fake,v1=fake";

const periodEnd30Days = (now: Date): DateTime.Utc =>
  DateTime.unsafeMake(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));

type CustomerState = {
  readonly stripeCustomerId: string;
  readonly organizationId: OrganizationId;
};

type SubscriptionRecord = {
  readonly stripeSubscriptionId: string;
  readonly stripeCustomerId: string;
  status: string;
  currentPeriodEnd: DateTime.Utc | null;
};

export const FakeBillingGatewayLive = Layer.effect(
  BillingGateway,
  Effect.gen(function* () {
    const customers = yield* Ref.make(HashMap.empty<OrganizationId, CustomerState>());
    const subscriptions = yield* Ref.make(HashMap.empty<string, SubscriptionRecord>());
    const counter = yield* Ref.make(0);

    const nextId = (prefix: string): Effect.Effect<string> =>
      Ref.modify(counter, (n) => [`${prefix}_test_${n + 1}`, n + 1]);

    const createCustomer = (input: CreateCustomerInput): Effect.Effect<CreateCustomerResult> =>
      Effect.gen(function* () {
        const existing = yield* Ref.get(customers).pipe(
          Effect.map((m) => HashMap.get(m, input.organizationId)),
        );
        if (Option.isSome(existing)) {
          return { stripeCustomerId: existing.value.stripeCustomerId };
        }
        const id = yield* nextId("cus");
        yield* Ref.update(
          customers,
          HashMap.set(input.organizationId, {
            stripeCustomerId: id,
            organizationId: input.organizationId,
          }),
        );
        return { stripeCustomerId: id };
      });

    const createSubscription = (input: CreateSubscriptionInput): Effect.Effect<SubscriptionState> =>
      Effect.gen(function* () {
        const id = yield* nextId("sub");
        const periodEnd = periodEnd30Days(new Date());
        const record: SubscriptionRecord = {
          stripeSubscriptionId: id,
          stripeCustomerId: input.stripeCustomerId,
          status: "active",
          currentPeriodEnd: periodEnd,
        };
        yield* Ref.update(subscriptions, HashMap.set(id, record));
        return {
          stripeSubscriptionId: id,
          status: record.status,
          currentPeriodEnd: record.currentPeriodEnd,
        };
      });

    const cancelSubscription = (
      input: CancelSubscriptionInput,
    ): Effect.Effect<CancelSubscriptionResult> =>
      Effect.gen(function* () {
        const found = yield* Ref.get(subscriptions).pipe(
          Effect.map((m) => HashMap.get(m, input.stripeSubscriptionId)),
        );
        if (Option.isNone(found)) {
          // Mirroring Stripe: cancel-of-unknown is a no-op from the
          // gateway's perspective; the use case decides what to do.
          return { status: "canceled", currentPeriodEnd: null };
        }
        const updated: SubscriptionRecord = {
          ...found.value,
          status: "canceled",
        };
        yield* Ref.update(subscriptions, HashMap.set(input.stripeSubscriptionId, updated));
        return { status: updated.status, currentPeriodEnd: updated.currentPeriodEnd };
      });

    // Tests synthesize webhook deliveries by JSON-encoding a
    // StripeWebhookEvent and passing FAKE_WEBHOOK_SIGNATURE. We bypass
    // real cryptography (the only thing that would catch a Stripe-side
    // signing-key change anyway) and decode through the contract
    // Schema so a malformed payload still fails explicitly.
    const verifyAndParseWebhook = (
      input: VerifyWebhookInput,
    ): Effect.Effect<StripeWebhookEvent, InvalidWebhookSignature> => {
      if (input.signature !== FAKE_WEBHOOK_SIGNATURE) {
        return Effect.fail(
          new InvalidWebhookSignature({ message: "fake gateway: signature mismatch" }),
        );
      }
      return Effect.try({
        try: () => JSON.parse(input.payload) as unknown,
        catch: () => new InvalidWebhookSignature({ message: "fake gateway: invalid JSON" }),
      }).pipe(
        Effect.flatMap((parsed) =>
          decodeWebhookEvent(parsed).pipe(
            Effect.mapError(
              (cause) =>
                new InvalidWebhookSignature({
                  message: `fake gateway: payload does not match StripeWebhookEvent shape: ${String(cause)}`,
                }),
            ),
          ),
        ),
      );
    };

    return BillingGateway.of({
      createCustomer,
      createSubscription,
      cancelSubscription,
      verifyAndParseWebhook,
    });
  }),
);
