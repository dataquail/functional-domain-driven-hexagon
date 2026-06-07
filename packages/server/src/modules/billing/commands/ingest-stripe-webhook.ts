import * as Effect from "effect/Effect";

import { WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event-repository.js";
import { StripeWebhookIngested } from "@/modules/billing/domain/stripe-webhook-events.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

import {
  type IngestStripeWebhookCommand,
  type IngestStripeWebhookOutput,
} from "./ingest-stripe-webhook-command.js";

// Race-free idempotency: try-insert is the claim. A redelivery (manual
// retry, dashboard re-send) hits the unique key and the handler
// short-circuits to void without emitting the domain event — so
// downstream subscribers (e.g. subscription status sync) never fire
// twice for the same delivery.
//
// The repository's `findByStripeEventId` exists for audit/dashboard
// read paths; the write path here intentionally skips it because
// "find then insert" introduces a race window. Postgres' unique
// constraint is the arbiter.
export const ingestStripeWebhook = (cmd: IngestStripeWebhookCommand): IngestStripeWebhookOutput =>
  Effect.gen(function* () {
    const repo = yield* WebhookEventRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;

    yield* uow
      .run(
        Effect.gen(function* () {
          const claimed = yield* repo.insert(cmd.stripeEvent.eventId).pipe(
            Effect.as(true),
            Effect.catchTag("WebhookEventAlreadyRecorded", () => Effect.succeed(false)),
          );
          if (!claimed) return;
          yield* bus.dispatch([StripeWebhookIngested.make({ stripeEvent: cmd.stripeEvent })]);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
  });
