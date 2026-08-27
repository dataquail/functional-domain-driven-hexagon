import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import {
  BillingGatewayUnavailable,
  SubscriptionNotFound,
} from "@/modules/billing/domain/subscription/subscription.errors.js";
import { SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const CancelSubscriptionCommand = Command.make("CancelSubscriptionCommand", {
  payload: { organizationId: OrganizationId },
  success: SubscriptionRoot,
  failure: Schema.Union([SubscriptionNotFound, BillingGatewayUnavailable, PersistenceUnavailable]),
});
export type CancelSubscriptionPayload = Command.Payload<typeof CancelSubscriptionCommand>;
