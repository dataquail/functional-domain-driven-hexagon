import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription-repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

export const MarkSubscriptionStatusCommand = Schema.TaggedStruct("MarkSubscriptionStatusCommand", {
  stripeSubscriptionId: Schema.String,
  status: Schema.String,
  currentPeriodEnd: Schema.NullOr(Schema.DateTimeUtc),
});
export type MarkSubscriptionStatusCommand = typeof MarkSubscriptionStatusCommand.Type;
export type MarkSubscriptionStatusCommandInput = {
  readonly stripeSubscriptionId: string;
  readonly status: string;
  readonly currentPeriodEnd: DateTime.Utc | null;
};

export const markSubscriptionStatusCommandSpanAttributes: SpanAttributesExtractor<
  MarkSubscriptionStatusCommand
> = (cmd) => ({
  "subscription.stripe_id": cmd.stripeSubscriptionId,
  "subscription.status": cmd.status,
});

// Returns void: webhook deliveries are observer-only — Stripe doesn't
// care about our response shape beyond the status code. Missing
// subscription is silently swallowed because Stripe may push an
// `updated` for a subscription whose `created` we haven't observed
// yet (out-of-order delivery is normal).
export type MarkSubscriptionStatusOutput = Effect.Effect<
  void,
  PersistenceUnavailable,
  SubscriptionRepository | DomainEventBus | UnitOfWork
>;
