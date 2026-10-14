import { CommandBus } from "@effect-server-utils/cqrs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DomainEventBus } from "@/globals/application/ports/event-bus.js";
import {
  SyncSubscriptionCommand,
  type SyncSubscriptionPayload,
} from "@/modules/billing/commands/sync-subscription.command.js";
import { StripeWebhookIngested } from "@/modules/billing/domain/webhook-event/stripe-webhook.events.js";

// Inbound event adapter (ADR-0007): subscribes to the same-module
// `StripeWebhookIngested` domain event, translates Stripe's subscription
// lifecycle vocabulary (including `deleted` → "canceled") into a
// Stripe-agnostic `SyncSubscriptionCommand`, and dispatches it. Non-
// subscription events (invoice.*, unknown) claim no domain action, so
// nothing is dispatched. Bus-only — the command handler owns the
// repository lookup and the status mutation.
export const StripeWebhookEventAdapterLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const domainEventBus = yield* DomainEventBus;
    const commandBus = yield* CommandBus;

    // `orDie` rolls the ingest back on a transient failure — the immediate
    // bus runs this in the ingest command's fiber, so the dispatched
    // command's `withUnitOfWork` opens a nested savepoint on its
    // transaction.
    const syncSubscription = (
      subscription: Omit<SyncSubscriptionPayload, "status">,
      status: string,
    ) =>
      commandBus
        .execute(SyncSubscriptionCommand, {
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        })
        .pipe(Effect.orDie);

    yield* domainEventBus.subscribe(StripeWebhookIngested, (event) => {
      const stripeEvent = event.stripeEvent;

      switch (stripeEvent.type) {
        case "customer.subscription.deleted":
          return syncSubscription(stripeEvent.subscription, "canceled");

        case "customer.subscription.created":
        case "customer.subscription.updated":
          return syncSubscription(stripeEvent.subscription, stripeEvent.subscription.status);

        case "invoice.paid":
        case "invoice.payment_failed":
        case "unknown":
          return Effect.void;
      }
    });
  }),
);
