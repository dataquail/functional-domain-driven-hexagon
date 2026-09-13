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
import { organizationLayer } from "@/modules/organization/organization.exports.js";
import { roleLayer } from "@/modules/role/role.exports.js";

const makeBillingModule = <RIn>(commands: Layer.Layer<BillingCommands, never, RIn>) => ({
  layer: Layer.mergeAll(commands, BillingQueriesLive, BillingPoliciesLive).pipe(
    Layer.provide(organizationLayer),
    Layer.provide(roleLayer),
  ),

  http: Layer.mergeAll(BillingLive, BillingWebhooksLive, StripeWebhookEventAdapterLive),
});

export const BillingModule = makeBillingModule(BillingCommandsLive);
export type BillingModule = typeof BillingModule;
export const BillingModuleFake: BillingModule = makeBillingModule(BillingCommandsFake);
