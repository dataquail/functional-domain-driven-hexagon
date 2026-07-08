import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { BillingGateway } from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription.repository.js";
import { SubscriptionNotFound } from "@/modules/billing/domain/subscription.errors.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription.root.js";
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

  const found = yield* repo.findOneByOrganizationId(cmd.organizationId);
  if (Option.isNone(found)) {
    return yield* Effect.fail(new SubscriptionNotFound({ organizationId: cmd.organizationId }));
  }
  const existing = found.value;

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
