import * as Schema from "effect/Schema";

import { DomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { SubscriptionId } from "./subscription.id.js";

export const SubscriptionStarted = DomainEvent("SubscriptionStarted", {
  subscriptionId: SubscriptionId,
  organizationId: OrganizationId,
  stripeSubscriptionId: Schema.String,
  status: Schema.String,
});
export type SubscriptionStarted = typeof SubscriptionStarted.Type;

export const subscriptionStartedSpanAttributes: SpanAttributesExtractor<SubscriptionStarted> = (
  event,
) => ({
  "subscription.id": event.subscriptionId,
  "organization.id": event.organizationId,
  "subscription.stripe_id": event.stripeSubscriptionId,
  "subscription.status": event.status,
});

export const SubscriptionStatusChanged = DomainEvent("SubscriptionStatusChanged", {
  subscriptionId: SubscriptionId,
  organizationId: OrganizationId,
  status: Schema.String,
  previousStatus: Schema.String,
});
export type SubscriptionStatusChanged = typeof SubscriptionStatusChanged.Type;

export const subscriptionStatusChangedSpanAttributes: SpanAttributesExtractor<
  SubscriptionStatusChanged
> = (event) => ({
  "subscription.id": event.subscriptionId,
  "organization.id": event.organizationId,
  "subscription.status": event.status,
  "subscription.previous_status": event.previousStatus,
});

export const SubscriptionCanceled = DomainEvent("SubscriptionCanceled", {
  subscriptionId: SubscriptionId,
  organizationId: OrganizationId,
});
export type SubscriptionCanceled = typeof SubscriptionCanceled.Type;

export const subscriptionCanceledSpanAttributes: SpanAttributesExtractor<SubscriptionCanceled> = (
  event,
) => ({
  "subscription.id": event.subscriptionId,
  "organization.id": event.organizationId,
});

export type SubscriptionEvent =
  | SubscriptionStarted
  | SubscriptionStatusChanged
  | SubscriptionCanceled;
