import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { DomainEventBus } from "@/globals/application/ports/event-bus.ts";
import { BillingGateway } from "@/modules/billing/domain/ports/clients/billing-gateway.client.ts";
import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription/subscription.errors.ts";
import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.ts";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.ts";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription/subscription.root-ops.ts";
import { SubscriptionSpecifications } from "@/modules/billing/domain/subscription/subscription.specification.ts";

import { type StartSubscriptionPayload } from "./start-subscription.command.ts";

// External IO (`gateway.createCustomer` / `createSubscription`) runs
// OUTSIDE the unit of work. If the DB insert fails after the gateway
// calls succeed we leave a Stripe customer + subscription orphaned —
// the reconciliation problem is real but out of scope for the MVP.
// The local repo insert is wrapped in the UoW so the bus dispatch
// still rolls back with it if a downstream subscriber defects.
export const startSubscriptionHandler = Effect.fn("startSubscriptionHandler")(function* (
  cmd: StartSubscriptionPayload,
) {
  const repo = yield* SubscriptionRepository;
  const gateway = yield* BillingGateway;
  const bus = yield* DomainEventBus;

  // Idempotency check at the use-case layer: avoid a Stripe-side
  // double-charge if a caller retries POST after a network blip.
  const existing = yield* repo.findOne(
    SubscriptionSpecifications.forOrganization(cmd.organizationId),
  );

  if (Option.isSome(existing)) {
    return yield* new SubscriptionAlreadyExistsForOrganization({
      organizationId: cmd.organizationId,
    });
  }

  const customer = yield* gateway.createCustomer({ organizationId: cmd.organizationId });

  const stripeSub = yield* gateway.createSubscription({
    stripeCustomerId: customer.stripeCustomerId,
  });

  const crypto = yield* Crypto.Crypto;
  const id = SubscriptionId.make(yield* Effect.orDie(crypto.randomUUIDv4));
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
