import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription-repository.js";
import * as Subscription from "@/modules/billing/domain/subscription.aggregate.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

import {
  type MarkSubscriptionStatusCommand,
  type MarkSubscriptionStatusOutput,
} from "./mark-subscription-status-command.js";

export const markSubscriptionStatus = (
  cmd: MarkSubscriptionStatusCommand,
): MarkSubscriptionStatusOutput =>
  Effect.gen(function* () {
    const repo = yield* SubscriptionRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;

    const found = yield* repo.findByStripeSubscriptionId(cmd.stripeSubscriptionId);
    if (Option.isNone(found)) {
      // Out-of-order delivery — we'll see this subscription's
      // `created` event eventually, at which point our local row will
      // be in sync. Dropping silently is the right move; failing
      // would make Stripe retry forever.
      return;
    }
    const existing = found.value;

    const now = yield* DateTime.now;
    const { events, subscription } = Subscription.applyStatus(existing, {
      status: cmd.status,
      currentPeriodEnd: cmd.currentPeriodEnd,
      now,
    });

    yield* uow
      .run(
        Effect.gen(function* () {
          yield* repo.update(subscription);
          yield* bus.dispatch(events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
  });
