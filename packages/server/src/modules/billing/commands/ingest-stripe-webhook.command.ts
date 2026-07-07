import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type BillingGateway } from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import { type WebhookEventRepository } from "@/modules/billing/domain/ports/repositories/webhook-event.repository.js";
import { type InvalidWebhookSignature } from "@/modules/billing/domain/subscription.errors.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

// Single entry point for a Stripe webhook delivery. The endpoint is
// pure translation (read raw payload + signature header → dispatch);
// ALL orchestration — signature verification, payload parsing,
// idempotency claim, downstream fan-out — lives under this command.
// The handler emits `StripeWebhookIngested`; the per-type
// subscription-mutation logic lives in a sibling event handler
// reacting to that domain event (CQRS alternation: command → event
// → command).
//
// `payload` is the EXACT raw bytes Stripe signed (the endpoint reads
// `HttpServerRequest.text` — `constructEvent` in the gateway needs
// these unmodified). `signature` is the `stripe-signature` header.
export const IngestStripeWebhookCommand = Schema.TaggedStruct("IngestStripeWebhookCommand", {
  payload: Schema.String,
  signature: Schema.String,
});
export type IngestStripeWebhookCommand = typeof IngestStripeWebhookCommand.Type;

export const ingestStripeWebhookCommandSpanAttributes: SpanAttributesExtractor<
  IngestStripeWebhookCommand
> = (cmd) => ({
  // The Stripe event id isn't known until after `verifyAndParseWebhook`
  // succeeds; the bus boundary records what it has — the raw payload
  // size — and the handler attaches the parsed `stripe.event.{id,type}`
  // when it emits `StripeWebhookIngested`.
  "stripe.payload.bytes": cmd.payload.length,
});

export type IngestStripeWebhookOutput = Effect.Effect<
  void,
  InvalidWebhookSignature | PersistenceUnavailable,
  BillingGateway | WebhookEventRepository | DomainEventBus | UnitOfWork
>;
