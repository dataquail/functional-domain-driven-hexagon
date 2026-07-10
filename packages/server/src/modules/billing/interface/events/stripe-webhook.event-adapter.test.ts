// Unit test for the stripe-webhook inbound adapter. Verifies the
// translation from `StripeWebhookIngested` to a `SyncSubscriptionCommand`
// dispatch: subscription lifecycle events dispatch (with `deleted` mapped to
// "canceled"); invoice/unknown events dispatch nothing. The subscription
// mutation itself is covered by the SyncSubscription handler unit test, and
// the full HTTP → ingest → event → adapter → sync chain by
// stripe-webhook.endpoint.integration.test.ts.

import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type SyncSubscriptionCommand } from "@/modules/billing/commands/sync-subscription.command.js";
import { type StripeWebhookEvent } from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import { StripeWebhookIngested } from "@/modules/billing/domain/stripe-webhook.events.js";
import { StripeWebhookEventAdapterLive } from "@/modules/billing/interface/events/stripe-webhook.event-adapter.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { makeDomainEventBusLive } from "@/platform/domain-event-bus-live.js";
import { fakeTransaction } from "@/test-utils/fake-transaction-context.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedCommands, RecordingCommandBus } from "@/test-utils/recording-command-bus.js";

const stripeSubId = "sub_test";

const subEvent = (
  type: "created" | "updated" | "deleted",
  status = "past_due",
): StripeWebhookEvent => ({
  eventId: `evt_test_${type}`,
  type: `customer.subscription.${type}`,
  subscription: { stripeSubscriptionId: stripeSubId, status, currentPeriodEnd: null },
});

const TestLayer = StripeWebhookEventAdapterLive.pipe(
  Layer.provideMerge(makeDomainEventBusLive()),
  Layer.provideMerge(RecordingCommandBus),
  Layer.provideMerge(IdentityUnitOfWork),
);

const dispatchAndReadCommands = (stripeEvent: StripeWebhookEvent) =>
  Effect.gen(function* () {
    const bus = yield* DomainEventBus;
    const rec = yield* RecordedCommands;
    yield* bus.dispatch([StripeWebhookIngested.make({ stripeEvent })]);
    return yield* rec.byTag<SyncSubscriptionCommand>("SyncSubscriptionCommand");
  }).pipe(Database.TransactionContext.provide(fakeTransaction), Effect.provide(TestLayer));

describe("StripeWebhookEventAdapterLive", () => {
  it.effect(
    "on customer.subscription.updated → dispatches SyncSubscription with the reported status",
    () =>
      Effect.gen(function* () {
        const commands = yield* dispatchAndReadCommands(subEvent("updated", "active"));
        deepStrictEqual(commands.length, 1);
        const command = commands[0];
        if (command === undefined) throw new Error("expected a SyncSubscriptionCommand");
        deepStrictEqual(command.stripeSubscriptionId, stripeSubId);
        deepStrictEqual(command.status, "active");
      }),
  );

  it.effect("on customer.subscription.deleted → maps status to 'canceled'", () =>
    Effect.gen(function* () {
      const commands = yield* dispatchAndReadCommands(subEvent("deleted"));
      deepStrictEqual(commands.length, 1);
      deepStrictEqual(commands[0]?.status, "canceled");
    }),
  );

  it.effect("on invoice.paid → dispatches nothing", () =>
    Effect.gen(function* () {
      const commands = yield* dispatchAndReadCommands({
        eventId: "evt_test_invoice_paid",
        type: "invoice.paid",
        invoice: { stripeSubscriptionId: null },
      });
      deepStrictEqual(commands.length, 0);
    }),
  );

  it.effect("on unknown event type → dispatches nothing", () =>
    Effect.gen(function* () {
      const commands = yield* dispatchAndReadCommands({
        eventId: "evt_test_unknown",
        type: "unknown",
      });
      deepStrictEqual(commands.length, 0);
    }),
  );
});
