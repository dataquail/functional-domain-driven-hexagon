import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { BillingGateway } from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription.repository.js";
import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription.errors.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription.id.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription.root.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

import { type StartSubscriptionCommand } from "./start-subscription.command.js";

// External IO (`gateway.createCustomer` / `createSubscription`) runs
// OUTSIDE the unit of work. If the DB insert fails after the gateway
// calls succeed we leave a Stripe customer + subscription orphaned —
// the reconciliation problem is real but out of scope for the MVP.
// The local repo insert is wrapped in the UoW so the bus dispatch
// still rolls back with it if a downstream subscriber defects.
export const startSubscription = Effect.fn("startSubscription")(function* (
  cmd: StartSubscriptionCommand,
) {
  const repo = yield* SubscriptionRepository;
  const gateway = yield* BillingGateway;
  const bus = yield* DomainEventBus;

  // Idempotency check at the use-case layer: avoid a Stripe-side
  // double-charge if a caller retries POST after a network blip.
  const existing = yield* repo.findOneByOrganizationId(cmd.organizationId);
  if (Option.isSome(existing)) {
    return yield* new SubscriptionAlreadyExistsForOrganization({
      organizationId: cmd.organizationId,
    });
  }

  const customer = yield* gateway.createCustomer({ organizationId: cmd.organizationId });
  const stripeSub = yield* gateway.createSubscription({
    stripeCustomerId: customer.stripeCustomerId,
  });

  const id = SubscriptionId.make(yield* Effect.sync(() => crypto.randomUUID()));
  const now = yield* DateTime.now;
  const { events, subscription } = SubscriptionRootOps.create({
    id,
    organizationId: cmd.organizationId,
    stripeCustomerId: customer.stripeCustomerId,
    stripeSubscriptionId: stripeSub.stripeSubscriptionId,
    status: stripeSub.status,
    currentPeriodEnd: stripeSub.currentPeriodEnd,
    now,
  });

  yield* Effect.gen(function* () {
    yield* repo.insertOne(subscription);
    yield* bus.dispatch(events);
  }).pipe(withUnitOfWork);

  return subscription;
});
