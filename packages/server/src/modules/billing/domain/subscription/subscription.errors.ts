import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

export class SubscriptionNotFound extends Schema.TaggedErrorClass<SubscriptionNotFound>(
  "SubscriptionNotFound",
)("SubscriptionNotFound", { organizationId: OrganizationId }) {}

export class SubscriptionAlreadyExistsForOrganization extends Schema.TaggedErrorClass<SubscriptionAlreadyExistsForOrganization>(
  "SubscriptionAlreadyExistsForOrganization",
)("SubscriptionAlreadyExistsForOrganization", { organizationId: OrganizationId }) {}

// External billing provider failed (network, 5xx, rate-limit, anything
// non-domain). Surfaced as 502 BadGateway at the HTTP boundary —
// distinct from `PersistenceUnavailable` (our DB) so an oncall sees
// which dependency failed.
export class BillingGatewayUnavailable extends Schema.TaggedErrorClass<BillingGatewayUnavailable>(
  "BillingGatewayUnavailable",
)("BillingGatewayUnavailable", { message: Schema.String }) {}

// Webhook signature didn't verify against `STRIPE_WEBHOOK_SECRET`.
// Distinct error type so the endpoint can return 401 deterministically
// regardless of how the gateway reports it.
export class InvalidWebhookSignature extends Schema.TaggedErrorClass<InvalidWebhookSignature>(
  "InvalidWebhookSignature",
)("InvalidWebhookSignature", { message: Schema.String }) {}
