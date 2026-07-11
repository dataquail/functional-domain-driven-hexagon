import {
  invitationAcceptedSpanAttributes,
  invitationIssuedSpanAttributes,
  invitationReissuedSpanAttributes,
  invitationRevokedSpanAttributes,
} from "@/modules/organization/domain/invitation/invitation.events.js";
import {
  membershipCreatedSpanAttributes,
  membershipRevokedSpanAttributes,
} from "@/modules/organization/domain/membership/membership.events.js";
import {
  organizationCreatedSpanAttributes,
  organizationRestoredSpanAttributes,
  organizationSoftDeletedSpanAttributes,
} from "@/modules/organization/domain/organization/organization.events.js";
import {
  organizationRoleGrantedSpanAttributes,
  organizationRoleRevokedSpanAttributes,
} from "@/modules/organization/domain/organization-roles/organization-role.events.js";
import { eventSpanAttributes } from "@/platform/ddd/ports/domain-event-bus.js";

export const organizationEventSpanAttributes = eventSpanAttributes({
  OrganizationCreated: organizationCreatedSpanAttributes,
  OrganizationSoftDeleted: organizationSoftDeletedSpanAttributes,
  OrganizationRestored: organizationRestoredSpanAttributes,
  MembershipCreated: membershipCreatedSpanAttributes,
  MembershipRevoked: membershipRevokedSpanAttributes,
  InvitationIssued: invitationIssuedSpanAttributes,
  InvitationAccepted: invitationAcceptedSpanAttributes,
  InvitationRevoked: invitationRevokedSpanAttributes,
  InvitationReissued: invitationReissuedSpanAttributes,
  OrganizationRoleGranted: organizationRoleGrantedSpanAttributes,
  OrganizationRoleRevoked: organizationRoleRevokedSpanAttributes,
});
