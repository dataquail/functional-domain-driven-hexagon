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
import { OrganizationLayer } from "@/modules/organization/organization.exports.js";
import { RoleLayer } from "@/modules/role/role.exports.js";

const makeBillingLayer = <RIn>(commands: Layer.Layer<BillingCommands, never, RIn>) =>
  Layer.mergeAll(commands, BillingQueriesLive, BillingPoliciesLive).pipe(
    Layer.provide(OrganizationLayer),
    Layer.provide(RoleLayer),
  );

export const BillingLayer = makeBillingLayer(BillingCommandsLive);
export type BillingLayer = typeof BillingLayer;
export const BillingLayerFake: BillingLayer = makeBillingLayer(BillingCommandsFake);

export const BillingHttpLayer = Layer.mergeAll(
  BillingLive,
  BillingWebhooksLive,
  StripeWebhookEventAdapterLive,
);
