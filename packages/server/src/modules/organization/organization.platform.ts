// The wiring surface: what the platform names to assemble and drive this module.
// What a peer module may reach is organization.exports.ts.
export { organizationCommandGroup, OrganizationCommands } from "./organization.command-handlers.ts";
export { organizationEventSpanAttributes } from "./organization.event-span-attributes.ts";
export { OrganizationModule } from "./organization.module.ts";
export { OrganizationQueries, organizationQueryGroup } from "./organization.query-handlers.ts";
export {
  OrganizationPoliciesLive,
  OrganizationPolicyContribution,
} from "./policies/organization.policies.ts";
export {
  OrganizationResolverEntry,
  OrganizationResolverEntryLive,
} from "./policies/organization.resource-resolver.ts";
