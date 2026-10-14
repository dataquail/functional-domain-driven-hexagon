// The platform surface: what the platform names to assemble and drive this
// module. What a peer module may reach is billing.exports.ts, and it is empty —
// billing is a leaf.
export { billingCommandGroup, BillingCommands } from "./billing.command-handlers.ts";
export { billingEventSpanAttributes } from "./billing.event-span-attributes.ts";
export { BillingModule } from "./billing.module.ts";
export { BillingQueries, billingQueryGroup } from "./billing.query-handlers.ts";

// The one service here whose adapter differs between composition roots, so a
// root can pick: Stripe in production, the fake in the test runtime — the same
// way each root picks its database, auth middleware and HTTP transport.
export { BillingGatewayFake } from "./infrastructure/clients/billing-gateway.client-fake.ts";
export { BillingGatewayLive } from "./infrastructure/clients/billing-gateway.client-live.ts";
export { BillingPoliciesLive, BillingPolicyContribution } from "./policies/billing.policies.ts";
export {
  BillingResolverEntry,
  BillingResolverEntryLive,
} from "./policies/billing.resource-resolver.ts";
