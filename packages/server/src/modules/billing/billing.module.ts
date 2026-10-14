import * as Layer from "effect/Layer";

import { BillingCommandsLive } from "@/modules/billing/billing.command-handlers.ts";
import { BillingQueriesLive } from "@/modules/billing/billing.query-handlers.ts";
import { StripeWebhookEventAdapterLive } from "@/modules/billing/interface/events/stripe-webhook.event-adapter.ts";
import {
  BillingLive,
  BillingWebhooksLive,
} from "@/modules/billing/interface/http/billing.endpoint-groups.ts";
import { BillingPoliciesLive } from "@/modules/billing/policies/billing.policies.ts";
import { OrganizationModule } from "@/modules/organization/organization.module.ts";
import { RoleModule } from "@/modules/role/role.module.ts";

export const BillingModule = {
  layer: Layer.mergeAll(BillingCommandsLive, BillingQueriesLive, BillingPoliciesLive).pipe(
    Layer.provide(OrganizationModule.layer),
    Layer.provide(RoleModule.layer),
  ),

  http: Layer.mergeAll(BillingLive, BillingWebhooksLive),

  events: StripeWebhookEventAdapterLive,
};
