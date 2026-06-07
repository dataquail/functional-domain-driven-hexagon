import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { StripeWebhookEvent } from "@/modules/billing/domain/ports/billing-gateway.js";
import { type WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event-repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

// Single entry point for a verified Stripe webhook delivery. The
// endpoint is pure translation (signature → parse → dispatch); ALL
// orchestration — idempotency claim, downstream fan-out — lives
// under this command. The handler emits `StripeWebhookIngested`;
// the per-type subscription-mutation logic lives in a sibling event
// handler reacting to that domain event (CQRS alternation:
// command → event → command).
export const IngestStripeWebhookCommand = Schema.TaggedStruct("IngestStripeWebhookCommand", {
  stripeEvent: StripeWebhookEvent,
});
export type IngestStripeWebhookCommand = typeof IngestStripeWebhookCommand.Type;

export const ingestStripeWebhookCommandSpanAttributes: SpanAttributesExtractor<
  IngestStripeWebhookCommand
> = (cmd) => ({
  "stripe.event.id": cmd.stripeEvent.eventId,
  "stripe.event.type": cmd.stripeEvent.type,
});

export type IngestStripeWebhookOutput = Effect.Effect<
  void,
  PersistenceUnavailable,
  WebhookEventRepository | DomainEventBus | UnitOfWork
>;
