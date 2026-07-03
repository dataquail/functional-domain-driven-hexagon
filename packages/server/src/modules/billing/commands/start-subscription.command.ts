import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type BillingGateway } from "@/modules/billing/domain/ports/clients/billing-gateway.client.js";
import { type SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription.repository.js";
import {
  type BillingGatewayUnavailable,
  type SubscriptionAlreadyExistsForOrganization,
} from "@/modules/billing/domain/subscription.errors.js";
import { type SubscriptionRoot } from "@/modules/billing/domain/subscription.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const StartSubscriptionCommand = Schema.TaggedStruct("StartSubscriptionCommand", {
  organizationId: OrganizationId,
});
export type StartSubscriptionCommand = typeof StartSubscriptionCommand.Type;

export const startSubscriptionCommandSpanAttributes: SpanAttributesExtractor<
  StartSubscriptionCommand
> = (cmd) => ({
  "organization.id": cmd.organizationId,
});

// `SubscriptionRepository` is discharged by the wrap in
// `billing-command-handlers.ts`; `BillingGateway` stays in R because
// it's swapped at the composition root (Live vs Fake).
export type StartSubscriptionOutput = Effect.Effect<
  SubscriptionRoot,
  SubscriptionAlreadyExistsForOrganization | BillingGatewayUnavailable | PersistenceUnavailable,
  SubscriptionRepository | BillingGateway | DomainEventBus | UnitOfWork
>;
