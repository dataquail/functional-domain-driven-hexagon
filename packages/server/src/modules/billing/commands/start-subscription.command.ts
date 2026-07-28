import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import {
  BillingGatewayUnavailable,
  SubscriptionAlreadyExistsForOrganization,
} from "@/modules/billing/domain/subscription/subscription.errors.js";
import { SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const StartSubscriptionCommand = Command.make("StartSubscriptionCommand", {
  payload: { organizationId: OrganizationId },
  success: SubscriptionRoot,
  failure: Schema.Union([
    SubscriptionAlreadyExistsForOrganization,
    BillingGatewayUnavailable,
    PersistenceUnavailable,
  ]),
});
export type StartSubscriptionPayload = Command.Payload<typeof StartSubscriptionCommand>;
