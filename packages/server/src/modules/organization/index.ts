export { AcceptInvitationCommand } from "./commands/accept-invitation-command.js";
export { CreateOrganizationCommand } from "./commands/create-organization-command.js";
export { InviteUserCommand } from "./commands/invite-user-command.js";
export { LeaveOrganizationCommand } from "./commands/leave-organization-command.js";
export { RemoveMemberCommand } from "./commands/remove-member-command.js";
export { RestoreOrganizationCommand } from "./commands/restore-organization-command.js";
export { RevokeInvitationCommand } from "./commands/revoke-invitation-command.js";
export { SoftDeleteOrganizationCommand } from "./commands/soft-delete-organization-command.js";
export {
  InvitationAccepted,
  InvitationIssued,
  InvitationRevoked,
} from "./domain/invitation-events.js";
export { MembershipCreated, MembershipRevoked } from "./domain/membership-events.js";
// MembershipServiceLive wraps the module's internal MembershipRepository
// into the platform-layer `MembershipService` ACL. Composed at the API
// layer (server.ts / test-server.ts) so policies — currently the org's
// own `IsMember`, future modules' policies as Phase 4 lands — can
// consume the generalized boolean shape without importing the repo type.
export {
  OrganizationCreated,
  OrganizationRestored,
  OrganizationSoftDeleted,
} from "./domain/organization-events.js";
export { MembershipServiceLive } from "./membership-service-live.js";
export { organizationCommandHandlers } from "./organization-command-handlers.js";
export { organizationEventSpanAttributes } from "./organization-event-span-attributes.js";
export { OrganizationModuleLive } from "./organization-module.js";
export { organizationQueryHandlers } from "./organization-query-handlers.js";
export { organizationPolicies, OrganizationResource } from "./policies/organization-policies.js";
export {
  OrganizationResolverEntry,
  OrganizationResolverEntryLive,
} from "./policies/organization-resource-resolver.js";
export { FindAllOrganizationsQuery } from "./queries/find-all-organizations-query.js";
