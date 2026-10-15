import * as Layer from "effect/Layer";

import { BillingCommandsLive } from "@/modules/billing/billing.command-handlers";
import { BillingQueriesLive } from "@/modules/billing/billing.query-handlers";
import { StripeWebhookEventAdapterLive } from "@/modules/billing/interface/events/stripe-webhook.event-adapter";
import {
  BillingLive,
  BillingWebhooksLive,
} from "@/modules/billing/interface/http/billing.endpoint-groups";
import { BillingPoliciesLive } from "@/modules/billing/policies/billing.policies";
import { OrganizationModule } from "@/modules/organization/organization.module";
import { RoleModule } from "@/modules/role/role.module";

export const BillingModule = {
  layer: Layer.mergeAll(BillingCommandsLive, BillingQueriesLive, BillingPoliciesLive).pipe(
    Layer.provide(OrganizationModule.layer),
    Layer.provide(RoleModule.layer),
  ),

  http: Layer.mergeAll(BillingLive, BillingWebhooksLive),

  events: StripeWebhookEventAdapterLive,
};
