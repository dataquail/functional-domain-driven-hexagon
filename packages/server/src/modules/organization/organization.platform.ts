// The wiring surface: what the platform names to assemble and drive this module.
// What a peer module may reach is organization.exports.ts.
export { organizationCommandGroup, OrganizationCommands } from "./organization.command-handlers";
export { organizationEventSpanAttributes } from "./organization.event-span-attributes";
export { OrganizationModule } from "./organization.module";
export { OrganizationQueries, organizationQueryGroup } from "./organization.query-handlers";
export {
  OrganizationPoliciesLive,
  OrganizationPolicyContribution,
} from "./policies/organization.policies";
export {
  OrganizationResolverEntry,
  OrganizationResolverEntryLive,
} from "./policies/organization.resource-resolver";
