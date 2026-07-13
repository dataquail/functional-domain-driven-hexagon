import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { BillingGateway } from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import { SubscriptionNotFound } from "@/modules/billing/domain/subscription/subscription.errors.js";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "@/modules/billing/domain/subscription/subscription.specification.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

import { type CancelSubscriptionCommand } from "./cancel-subscription.command.js";

// Cancels upstream first, then flips local status. If Stripe cancel
// succeeds but the local update fails, the subscription is canceled
// from Stripe's POV — the periodic reconciliation job (out of scope
// here) would catch the mismatch via the webhook that Stripe sends
// on cancel anyway, which would call MarkSubscriptionStatusCommand.
export const cancelSubscription = Effect.fn("cancelSubscription")(function* (
  cmd: CancelSubscriptionCommand,
) {
  const repo = yield* SubscriptionRepository;
  const gateway = yield* BillingGateway;
  const bus = yield* DomainEventBus;

  const existing = yield* repo.findOne(
    SubscriptionSpecifications.forOrganization(cmd.organizationId),
  );
  if (existing === null) {
    return yield* new SubscriptionNotFound({ organizationId: cmd.organizationId });
  }

  yield* gateway.cancelSubscription({
    stripeSubscriptionId: existing.stripeSubscriptionId,
  });

  const now = yield* DateTime.now;
  const { events, subscription } = SubscriptionRootOps.cancel(existing, now);

  yield* Effect.gen(function* () {
    yield* repo.updateOne(subscription);
    yield* bus.dispatch(events);
  }).pipe(withUnitOfWork);

  return subscription;
});
