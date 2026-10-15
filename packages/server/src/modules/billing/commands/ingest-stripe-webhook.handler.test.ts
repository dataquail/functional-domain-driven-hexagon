import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertDefined, assertNone } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { ingestStripeWebhookHandler } from "@/modules/billing/commands/ingest-stripe-webhook.handler";
import { InvalidWebhookSignature } from "@/modules/billing/domain/subscription/subscription.errors";
import { type StripeWebhookIngested } from "@/modules/billing/domain/webhook-event/stripe-webhook.events";
import { StripeWebhookEvent } from "@/modules/billing/domain/webhook-event/stripe-webhook.value-object";
import { WebhookEventRepository } from "@/modules/billing/domain/webhook-event/webhook-event.repository";
import { WebhookEventSpecifications } from "@/modules/billing/domain/webhook-event/webhook-event.specification";
import {
  BillingGatewayFake,
  FAKE_WEBHOOK_SIGNATURE,
} from "@/modules/billing/infrastructure/clients/billing-gateway.client-fake";
import { WebhookEventRepositoryFake } from "@/modules/billing/infrastructure/repositories/webhook-event.repository-fake";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus";

const TestLayer = Layer.mergeAll(
  BillingGatewayFake,
  WebhookEventRepositoryFake,
  RecordingEventBus,
  PassThroughUnitOfWork,
);

const subscriptionUpdated = (eventId: string): StripeWebhookEvent => ({
  eventId,
  type: "customer.subscription.updated",
  subscription: {
    stripeSubscriptionId: "sub_test",
    status: "past_due",
    currentPeriodEnd: Option.none(),
  },
});

const encodeWebhookPayload = Schema.encodeSync(Schema.fromJsonString(StripeWebhookEvent));

const cmd = (eventId: string, signature = FAKE_WEBHOOK_SIGNATURE) => ({
  payload: encodeWebhookPayload(subscriptionUpdated(eventId)),
  signature,
});

describe("ingestStripeWebhookHandler", () => {
  it.effect(
    "on first delivery: verifies signature, claims the id, emits StripeWebhookIngested",
    () =>
      Effect.gen(function* () {
        const repo = yield* WebhookEventRepository;
        const rec = yield* RecordedEvents;

        yield* ingestStripeWebhookHandler(cmd("evt_new"));

        yield* Effect.fromOption(
          yield* repo.findOne(WebhookEventSpecifications.withStripeEventId("evt_new")),
        );

        const events = yield* rec.byTag<StripeWebhookIngested>("StripeWebhookIngested");
        deepStrictEqual(events.length, 1);
        const [event] = events;
        assertDefined(event);
        deepStrictEqual(event.stripeEvent.eventId, "evt_new");
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("on bad signature: fails InvalidWebhookSignature, no claim, no event", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      const rec = yield* RecordedEvents;

      const error = yield* Effect.flip(
        ingestStripeWebhookHandler(cmd("evt_bad_sig", "wrong-signature")),
      );

      ok(Schema.is(InvalidWebhookSignature)(error));

      const seen = yield* repo.findOne(WebhookEventSpecifications.withStripeEventId("evt_bad_sig"));
      assertNone(seen);
      const events = yield* rec.byTag<StripeWebhookIngested>("StripeWebhookIngested");
      deepStrictEqual(events.length, 0);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("on redelivery: short-circuits without emitting a second event", () =>
    Effect.gen(function* () {
      const rec = yield* RecordedEvents;
      yield* ingestStripeWebhookHandler(cmd("evt_dup"));
      yield* ingestStripeWebhookHandler(cmd("evt_dup"));
      const events = yield* rec.byTag<StripeWebhookIngested>("StripeWebhookIngested");
      deepStrictEqual(events.length, 1);
    }).pipe(Effect.provide(TestLayer)),
  );
});
