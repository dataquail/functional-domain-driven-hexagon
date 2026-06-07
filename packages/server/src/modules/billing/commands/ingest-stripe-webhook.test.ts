import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { ingestStripeWebhook } from "@/modules/billing/commands/ingest-stripe-webhook.js";
import { IngestStripeWebhookCommand } from "@/modules/billing/commands/ingest-stripe-webhook-command.js";
import { type StripeWebhookEvent } from "@/modules/billing/domain/ports/billing-gateway.js";
import { WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event-repository.js";
import { type StripeWebhookIngested } from "@/modules/billing/domain/stripe-webhook-events.js";
import { InvalidWebhookSignature } from "@/modules/billing/domain/subscription-errors.js";
import {
  FAKE_WEBHOOK_SIGNATURE,
  FakeBillingGatewayLive,
} from "@/modules/billing/infrastructure/fake-billing-gateway.js";
import { WebhookEventRepositoryFake } from "@/modules/billing/infrastructure/webhook-event-repository-fake.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const TestLayer = Layer.mergeAll(
  FakeBillingGatewayLive,
  WebhookEventRepositoryFake,
  RecordingEventBus,
  IdentityUnitOfWork,
);

const subscriptionUpdated = (eventId: string): StripeWebhookEvent => ({
  eventId,
  type: "customer.subscription.updated",
  subscription: {
    stripeSubscriptionId: "sub_test",
    status: "past_due",
    currentPeriodEnd: null,
  },
});

const cmd = (eventId: string, signature = FAKE_WEBHOOK_SIGNATURE) =>
  IngestStripeWebhookCommand.make({
    payload: JSON.stringify(subscriptionUpdated(eventId)),
    signature,
  });

describe("ingestStripeWebhook", () => {
  it.effect(
    "on first delivery: verifies signature, claims the id, emits StripeWebhookIngested",
    () =>
      Effect.gen(function* () {
        const repo = yield* WebhookEventRepository;
        const rec = yield* RecordedEvents;

        yield* ingestStripeWebhook(cmd("evt_new"));

        const seen = yield* repo.findByStripeEventId("evt_new");
        ok(Option.isSome(seen));

        const events = yield* rec.byTag<StripeWebhookIngested>("StripeWebhookIngested");
        deepStrictEqual(events.length, 1);
        const event = events[0];
        if (event === undefined) throw new Error("expected StripeWebhookIngested");
        deepStrictEqual(event.stripeEvent.eventId, "evt_new");
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("on bad signature: fails InvalidWebhookSignature, no claim, no event", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      const rec = yield* RecordedEvents;

      const exit = yield* Effect.exit(ingestStripeWebhook(cmd("evt_bad_sig", "wrong-signature")));
      ok(Exit.isFailure(exit));
      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        ok(exit.cause.error instanceof InvalidWebhookSignature);
      }

      const seen = yield* repo.findByStripeEventId("evt_bad_sig");
      ok(Option.isNone(seen));
      const events = yield* rec.byTag<StripeWebhookIngested>("StripeWebhookIngested");
      deepStrictEqual(events.length, 0);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("on redelivery: short-circuits without emitting a second event", () =>
    Effect.gen(function* () {
      const rec = yield* RecordedEvents;
      yield* ingestStripeWebhook(cmd("evt_dup"));
      yield* ingestStripeWebhook(cmd("evt_dup"));
      const events = yield* rec.byTag<StripeWebhookIngested>("StripeWebhookIngested");
      deepStrictEqual(events.length, 1);
    }).pipe(Effect.provide(TestLayer)),
  );
});
