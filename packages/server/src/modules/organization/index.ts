export { AcceptInvitationCommand } from "./commands/accept-invitation.command.js";
export { CreateOrganizationCommand } from "./commands/create-organization.command.js";
export { GrantOrganizationRoleCommand } from "./commands/grant-organization-role.command.js";
export { InviteUserCommand } from "./commands/invite-user.command.js";
export { LeaveOrganizationCommand } from "./commands/leave-organization.command.js";
export { RemoveMemberCommand } from "./commands/remove-member.command.js";
export { ResendInvitationCommand } from "./commands/resend-invitation.command.js";
export { RestoreOrganizationCommand } from "./commands/restore-organization.command.js";
export { RevokeInvitationCommand } from "./commands/revoke-invitation.command.js";
export { RevokeOrganizationRoleCommand } from "./commands/revoke-organization-role.command.js";
export { SoftDeleteOrganizationCommand } from "./commands/soft-delete-organization.command.js";
export {
  InvitationAccepted,
  InvitationIssued,
  InvitationReissued,
  InvitationRevoked,
} from "./domain/invitation/invitation.events.js";
export { MembershipCreated, MembershipRevoked } from "./domain/membership/membership.events.js";
export {
  OrganizationCreated,
  OrganizationRestored,
  OrganizationSoftDeleted,
} from "./domain/organization/organization.events.js";
export { CannotPromoteSelfInOrganization } from "./domain/organization-roles/organization-role.errors.js";
export {
  OrganizationRoleGranted,
  OrganizationRoleRevoked,
} from "./domain/organization-roles/organization-role.events.js";
// MembershipServiceLive wraps the module's internal MembershipRepository
// into the platform-layer `MembershipService` ACL. OrganizationRoleServiceLive
// (Phase 4) plays the same role for the per-(user, org) role assignments.
// Both compose at the API layer (server.ts / test-server.ts) so policies
// — `IsMember`, `IsOrgAdmin`, future modules' admin checks — can consume
// the generalized shape without importing the repos.
export { organizationCommandHandlers } from "./organization.command-handlers.js";
export { organizationEventSpanAttributes } from "./organization.event-span-attributes.js";
export { OrganizationHttpDepsLive, OrganizationModuleLive } from "./organization.module.js";
export { organizationQueryHandlers } from "./organization.query-handlers.js";
export { organizationPolicies, OrganizationResource } from "./policies/organization.policies.js";
export {
  OrganizationResolverEntry,
  OrganizationResolverEntryLive,
} from "./policies/organization.resource-resolver.js";
export { MembershipServiceLive } from "./policies/public/membership.service-live.js";
export { OrganizationRoleServiceLive } from "./policies/public/organization-role.service-live.js";
export { FindAllOrganizationsQuery } from "./queries/find-all-organizations.query.js";
export { FindMembershipQuery } from "./queries/find-membership.query.js";
export { FindMyOrganizationsQuery } from "./queries/find-my-organizations.query.js";
export { FindPendingInvitationsQuery } from "./queries/find-pending-invitations.query.js";
export { FindUserOrganizationRolesQuery } from "./queries/find-user-organization-roles.query.js";
