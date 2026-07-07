import * as Effect from "effect/Effect";

import { BillingGateway } from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import { WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event.repository.js";
import { StripeWebhookIngested } from "@/modules/billing/domain/stripe-webhook.events.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

import {
  type IngestStripeWebhookCommand,
  type IngestStripeWebhookOutput,
} from "./ingest-stripe-webhook.command.js";

// Signature verification + parsing + idempotency claim + domain event
// dispatch in one transactional unit. Verifies OUTSIDE the unit of
// work — `verifyAndParseWebhook` is a stateless cryptographic check
// with no DB side-effects, and a bad signature must NOT consume a row
// or leave the transaction open longer than necessary.
//
// Race-free idempotency: try-insert is the claim. A redelivery
// (manual retry, dashboard re-send) hits the unique key and the
// handler short-circuits to void without emitting the domain event —
// downstream subscribers (subscription status sync) never fire twice
// for the same delivery.
//
// The repository's `findOneByStripeEventId` exists for audit/dashboard
// read paths; the write path here intentionally skips it because
// "find then insert" introduces a race window. Postgres' unique
// constraint is the arbiter.
export const ingestStripeWebhook = (cmd: IngestStripeWebhookCommand): IngestStripeWebhookOutput =>
  Effect.gen(function* () {
    const gateway = yield* BillingGateway;
    const repo = yield* WebhookEventRepository;
    const bus = yield* DomainEventBus;

    const stripeEvent = yield* gateway.verifyAndParseWebhook({
      payload: cmd.payload,
      signature: cmd.signature,
    });

    yield* Effect.gen(function* () {
      const claimed = yield* repo.insertOne(stripeEvent.eventId).pipe(
        Effect.as(true),
        Effect.catchTag("WebhookEventAlreadyRecorded", () => Effect.succeed(false)),
      );
      if (!claimed) return;
      yield* bus.dispatch([StripeWebhookIngested.make({ stripeEvent })]);
    }).pipe(withUnitOfWork);
  });
