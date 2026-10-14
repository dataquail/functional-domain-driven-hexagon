import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import {
  BillingGatewayUnavailable,
  SubscriptionAlreadyExistsForOrganization,
} from "@/modules/billing/domain/subscription/subscription.errors.ts";
import { SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.ts";

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
