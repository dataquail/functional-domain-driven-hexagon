import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { ingestStripeWebhook } from "@/modules/billing/commands/ingest-stripe-webhook.js";
import { IngestStripeWebhookCommand } from "@/modules/billing/commands/ingest-stripe-webhook-command.js";
import { type StripeWebhookEvent } from "@/modules/billing/domain/ports/billing-gateway.js";
import { WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event-repository.js";
import { type StripeWebhookIngested } from "@/modules/billing/domain/stripe-webhook-events.js";
import { WebhookEventRepositoryFake } from "@/modules/billing/infrastructure/webhook-event-repository-fake.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const TestLayer = Layer.mergeAll(WebhookEventRepositoryFake, RecordingEventBus, IdentityUnitOfWork);

const subscriptionUpdated = (eventId: string): StripeWebhookEvent => ({
  eventId,
  type: "customer.subscription.updated",
  subscription: {
    stripeSubscriptionId: "sub_test",
    status: "past_due",
    currentPeriodEnd: null,
  },
});

describe("ingestStripeWebhook", () => {
  it.effect("on first delivery: claims the id and emits StripeWebhookIngested", () =>
    Effect.gen(function* () {
      const repo = yield* WebhookEventRepository;
      const rec = yield* RecordedEvents;

      yield* ingestStripeWebhook(
        IngestStripeWebhookCommand.make({ stripeEvent: subscriptionUpdated("evt_new") }),
      );

      const seen = yield* repo.findByStripeEventId("evt_new");
      ok(Option.isSome(seen));

      const events = yield* rec.byTag<StripeWebhookIngested>("StripeWebhookIngested");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected StripeWebhookIngested");
      deepStrictEqual(event.stripeEvent.eventId, "evt_new");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("on redelivery: short-circuits without emitting a second event", () =>
    Effect.gen(function* () {
      const rec = yield* RecordedEvents;
      const cmd = IngestStripeWebhookCommand.make({ stripeEvent: subscriptionUpdated("evt_dup") });
      yield* ingestStripeWebhook(cmd);
      yield* ingestStripeWebhook(cmd);
      const events = yield* rec.byTag<StripeWebhookIngested>("StripeWebhookIngested");
      deepStrictEqual(events.length, 1);
    }).pipe(Effect.provide(TestLayer)),
  );
});
