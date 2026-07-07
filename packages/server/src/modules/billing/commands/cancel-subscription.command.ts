import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type BillingGateway } from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import { type SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription.repository.js";
import {
  type BillingGatewayUnavailable,
  type SubscriptionNotFound,
} from "@/modules/billing/domain/subscription.errors.js";
import { type SubscriptionRoot } from "@/modules/billing/domain/subscription.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const CancelSubscriptionCommand = Schema.TaggedStruct("CancelSubscriptionCommand", {
  organizationId: OrganizationId,
});
export type CancelSubscriptionCommand = typeof CancelSubscriptionCommand.Type;

export const cancelSubscriptionCommandSpanAttributes: SpanAttributesExtractor<
  CancelSubscriptionCommand
> = (cmd) => ({
  "organization.id": cmd.organizationId,
});

export type CancelSubscriptionOutput = Effect.Effect<
  SubscriptionRoot,
  SubscriptionNotFound | BillingGatewayUnavailable | PersistenceUnavailable,
  SubscriptionRepository | BillingGateway | DomainEventBus | UnitOfWork
>;
