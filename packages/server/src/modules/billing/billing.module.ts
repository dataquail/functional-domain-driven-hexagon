import * as Layer from "effect/Layer";

import {
  type BillingCommands,
  BillingCommandsFake,
  BillingCommandsLive,
} from "@/modules/billing/billing.command-handlers.js";
import { BillingQueriesLive } from "@/modules/billing/billing.query-handlers.js";
import { StripeWebhookEventAdapterLive } from "@/modules/billing/interface/events/stripe-webhook.event-adapter.js";
import { BillingLive, BillingWebhooksLive } from "@/modules/billing/interface/http/index.js";
import { BillingPoliciesLive } from "@/modules/billing/policies/billing.policies.js";
import { OrganizationModule } from "@/modules/organization/organization.module.js";
import { RoleModule } from "@/modules/role/role.module.js";

const makeBillingModule = <RIn>(commands: Layer.Layer<BillingCommands, never, RIn>) => ({
  layer: Layer.mergeAll(commands, BillingQueriesLive, BillingPoliciesLive).pipe(
    Layer.provide(OrganizationModule.layer),
    Layer.provide(RoleModule.layer),
  ),

  http: Layer.mergeAll(BillingLive, BillingWebhooksLive, StripeWebhookEventAdapterLive),
});

export const BillingModule = makeBillingModule(BillingCommandsLive);
export type BillingModule = typeof BillingModule;
export const BillingModuleFake: BillingModule = makeBillingModule(BillingCommandsFake);
