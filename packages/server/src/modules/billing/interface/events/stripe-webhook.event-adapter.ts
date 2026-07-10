import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SyncSubscriptionCommand } from "@/modules/billing/commands/sync-subscription.command.js";
import { StripeWebhookIngested } from "@/modules/billing/domain/stripe-webhook.events.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

// Inbound event adapter (ADR-0007): subscribes to the same-module
// `StripeWebhookIngested` domain event, translates Stripe's subscription
// lifecycle vocabulary (including `deleted` → "canceled") into a
// Stripe-agnostic `SyncSubscriptionCommand`, and dispatches it. Non-
// subscription events (invoice.*, unknown) claim no domain action, so
// nothing is dispatched. Bus-only — the command handler owns the
// repository lookup and the status mutation.
//
// `subscribe` requires a handler with no requirements/error channel. As in
// the wallet organization adapter, the dispatched command's application
// deps (DomainEventBus, UnitOfWork) are provided from captured singletons
// and its residual ambient `Database.Database` is elided via the documented
// cast — the immediate bus runs this handler in the ingest command's
// fully-provisioned fiber, so the command's `withUnitOfWork` opens a nested
// savepoint on the ingest transaction. `orDie` rolls the ingest back on a
// transient failure.
export const StripeWebhookEventAdapterLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const domainEventBus = yield* DomainEventBus;
    const commandBus = yield* CommandBus;
    const unitOfWork = yield* UnitOfWork;
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
          return commandBus
            .execute(
              SyncSubscriptionCommand.make({
                stripeSubscriptionId: stripeEvent.subscription.stripeSubscriptionId,
                status,
                currentPeriodEnd: stripeEvent.subscription.currentPeriodEnd,
              }),
            )
            .pipe(
              Effect.provideService(DomainEventBus, domainEventBus),
              Effect.provideService(UnitOfWork, unitOfWork),
              Effect.orDie,
            ) as Effect.Effect<void>;
        }
        case "invoice.paid":
        case "invoice.payment_failed":
        case "unknown":
          return Effect.void;
      }
    });
  }),
);
