import { CommandBus } from "@org/cqrs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SyncSubscriptionCommand } from "@/modules/billing/commands/sync-subscription.command.js";
import { StripeWebhookIngested } from "@/modules/billing/domain/webhook-event/stripe-webhook.events.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";

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
    yield* domainEventBus.subscribe(StripeWebhookIngested, (event) => {
      const stripeEvent = event.stripeEvent;
      switch (stripeEvent.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const status =
            stripeEvent.type === "customer.subscription.deleted"
              ? "canceled"
              : stripeEvent.subscription.status;
          // `orDie` rolls the ingest back on a transient failure — the immediate
          // bus runs this in the ingest command's fiber, so the dispatched
          // command's `withUnitOfWork` opens a nested savepoint on its
          // transaction.
          return commandBus
            .execute(SyncSubscriptionCommand, {
              stripeSubscriptionId: stripeEvent.subscription.stripeSubscriptionId,
              status,
              currentPeriodEnd: stripeEvent.subscription.currentPeriodEnd,
            })
            .pipe(Effect.orDie);
        }
        case "invoice.paid":
        case "invoice.payment_failed":
        case "unknown":
          return Effect.void;
      }
    });
  }),
);
