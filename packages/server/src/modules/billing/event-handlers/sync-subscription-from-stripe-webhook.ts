import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription-repository.js";
import { StripeWebhookIngested } from "@/modules/billing/domain/stripe-webhook-events.js";
import * as Subscription from "@/modules/billing/domain/subscription.aggregate.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";

// Reacts to `StripeWebhookIngested` and synchronises the local
// `Subscription` projection. Same-module event — no `interface/events/`
// adapter needed (that ACL pattern is for cross-module consumption).
//
// Per ADR-0007 this runs inside the publisher's fiber and inherits
// `TransactionContext`. The full chain (ingest claim → status mutation
// → SubscriptionStatusChanged dispatch) commits or rolls back as one
// unit.
//
// Acts as a use case directly rather than dispatching another command:
// dep-cruise's `event-handlers-isolation` rule forbids importing from
// sibling `commands/` (commands are reachable only from interface/
// or other commands), and the codebase pattern (see wallet's
// `create-wallet-when-organization-is-created.ts`) is event-handler-
// as-use-case anyway.
//
// Out-of-order webhook deliveries are silently dropped (`findByStripe-
// SubscriptionId` → None). Stripe may push an update for a subscription
// whose `created` we haven't observed yet; the eventual `created`
// delivery brings us back in sync.
export const SyncSubscriptionFromStripeWebhookLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const eventBus = yield* DomainEventBus;
    const repo = yield* SubscriptionRepository;
    yield* eventBus.subscribe(StripeWebhookIngested, (event) =>
      Effect.gen(function* () {
        const stripeEvent = event.stripeEvent;
        switch (stripeEvent.type) {
          case "customer.subscription.created":
          case "customer.subscription.updated":
          case "customer.subscription.deleted": {
            const found = yield* repo.findOneByStripeSubscriptionId(
              stripeEvent.subscription.stripeSubscriptionId,
            );
            if (Option.isNone(found)) return;
            const now = yield* DateTime.now;
            const nextStatus =
              stripeEvent.type === "customer.subscription.deleted"
                ? "canceled"
                : stripeEvent.subscription.status;
            const { events, subscription } = Subscription.applyStatus(found.value, {
              status: nextStatus,
              currentPeriodEnd: stripeEvent.subscription.currentPeriodEnd,
              now,
            });
            yield* repo.updateOne(subscription);
            yield* eventBus.dispatch(events);
            return;
          }
          case "invoice.paid":
          case "invoice.payment_failed":
          case "unknown":
            // MVP: claim already recorded, no domain action. Real
            // handling (credit balance on invoice.paid, notify on
            // payment_failed) lands when a product surface needs it.
            return;
        }
      }).pipe(Effect.orDie),
    );
  }),
);
