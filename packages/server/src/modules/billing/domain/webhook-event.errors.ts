import * as Schema from "effect/Schema";

// Surfaces a duplicate webhook delivery. The Stripe webhook endpoint
// catches this and short-circuits to a 200 ACK; no other site cares
// about it. Mirrors `SubscriptionAlreadyExistsForOrganization` — a
// unique-violation in the underlying table lifted into the typed
// error channel so the use case decides what to do.
export class WebhookEventAlreadyRecorded extends Schema.TaggedErrorClass<WebhookEventAlreadyRecorded>(
  "WebhookEventAlreadyRecorded",
)("WebhookEventAlreadyRecorded", { stripeEventId: Schema.String }) {}
