// The wiring surface: what the platform names to assemble and drive this module.
// What a peer module may reach is billing.exports.ts, and it is empty — billing
// is a leaf.
export { billingCommandGroup, BillingCommands } from "./billing.command-handlers.js";
export { billingEventSpanAttributes } from "./billing.event-span-attributes.js";
export { BillingModule } from "./billing.module.js";
// The gateway adapter a composition root picks between.
export { BillingQueries, billingQueryGroup } from "./billing.query-handlers.js";
export { BillingGatewayFake, BillingGatewayLive } from "./billing.shared-deps.js";
export { BillingPoliciesLive, BillingPolicyContribution } from "./policies/billing.policies.js";
export {
  BillingResolverEntry,
  BillingResolverEntryLive,
} from "./policies/billing.resource-resolver.js";
