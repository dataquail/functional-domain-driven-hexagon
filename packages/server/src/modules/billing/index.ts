// The wiring surface: what the platform names to assemble and drive this module.
// What a peer module may reach is billing.exports.ts, and it is empty — billing
// is a leaf.
export { billingCommandGroup, BillingCommands } from "./billing.command-handlers.js";
export { billingEventSpanAttributes } from "./billing.event-span-attributes.js";
// Two named modules ship the prod-vs-test gateway swap. The `BillingGateway`
// Tag stays private to the module's use-case ring — a composition root picks a
// module and never sees the Tag.
export { BillingModule, BillingModuleFake } from "./billing.module.js";
export { BillingQueries, billingQueryGroup } from "./billing.query-handlers.js";
export { BillingPoliciesLive, BillingPolicyContribution } from "./policies/billing.policies.js";
export {
  BillingResolverEntry,
  BillingResolverEntryLive,
} from "./policies/billing.resource-resolver.js";
