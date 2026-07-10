import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { type SyncSubscriptionCommand } from "@/modules/billing/commands/sync-subscription.command.js";
import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription.repository.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription.root-ops.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

// Syncs the local Subscription projection to a Stripe-reported status.
// Out-of-order deliveries — a status update for a subscription whose
// `created` we haven't observed yet — find no row and are dropped; the
// eventual `created` delivery brings us back in sync. Dispatched by the
// stripe-webhook event adapter inside the ingest command's transaction, so
// `withUnitOfWork` opens a nested savepoint (ADR-0007).
export const syncSubscription = Effect.fn("syncSubscription")(function* (
  cmd: SyncSubscriptionCommand,
) {
  const repo = yield* SubscriptionRepository;
  const bus = yield* DomainEventBus;
  const found = yield* repo.findOneByStripeSubscriptionId(cmd.stripeSubscriptionId);
  if (Option.isNone(found)) return;
  const now = yield* DateTime.now;
  const { events, subscription } = SubscriptionRootOps.applyStatus(found.value, {
    status: cmd.status,
    currentPeriodEnd: cmd.currentPeriodEnd,
    now,
  });
  yield* repo.updateOne(subscription);
  yield* bus.dispatch(events);
}, withUnitOfWork);
