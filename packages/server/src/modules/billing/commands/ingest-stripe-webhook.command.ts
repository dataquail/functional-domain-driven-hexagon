import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { InvalidWebhookSignature } from "@/modules/billing/domain/subscription/subscription.errors.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

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
// Neither reaches a span: the raw body is unbounded and the signature
// is a credential.
export const IngestStripeWebhook = Command.make("IngestStripeWebhookCommand", {
  payload: { payload: Schema.String, signature: Schema.String },
  success: Schema.Void,
  failure: Schema.Union([InvalidWebhookSignature, PersistenceUnavailable]),
});
export type IngestStripeWebhookPayload = Command.Payload<typeof IngestStripeWebhook>;
