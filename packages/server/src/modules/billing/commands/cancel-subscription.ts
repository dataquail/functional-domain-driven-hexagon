import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { BillingGateway } from "@/modules/billing/domain/ports/billing-gateway.js";
import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription-repository.js";
import * as Subscription from "@/modules/billing/domain/subscription.aggregate.js";
import { SubscriptionNotFound } from "@/modules/billing/domain/subscription-errors.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

import {
  type CancelSubscriptionCommand,
  type CancelSubscriptionOutput,
} from "./cancel-subscription-command.js";

// Cancels upstream first, then flips local status. If Stripe cancel
// succeeds but the local update fails, the subscription is canceled
// from Stripe's POV — the periodic reconciliation job (out of scope
// here) would catch the mismatch via the webhook that Stripe sends
// on cancel anyway, which would call MarkSubscriptionStatusCommand.
export const cancelSubscription = (cmd: CancelSubscriptionCommand): CancelSubscriptionOutput =>
  Effect.gen(function* () {
    const repo = yield* SubscriptionRepository;
    const gateway = yield* BillingGateway;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;

    const found = yield* repo.findByOrganizationId(cmd.organizationId);
    if (Option.isNone(found)) {
      return yield* Effect.fail(new SubscriptionNotFound({ organizationId: cmd.organizationId }));
    }
    const existing = found.value;

    yield* gateway.cancelSubscription({
      stripeSubscriptionId: existing.stripeSubscriptionId,
    });

    const now = yield* DateTime.now;
    const { events, subscription } = Subscription.cancel(existing, now);

    yield* uow
      .run(
        Effect.gen(function* () {
          yield* repo.update(subscription);
          yield* bus.dispatch(events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));

    return subscription;
  });
