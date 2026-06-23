import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";

import { Api } from "@/api.js";
import { acceptInvitationEndpoint } from "@/modules/organization/interface/http/accept-invitation.endpoint.js";
import { createEndpoint } from "@/modules/organization/interface/http/create.endpoint.js";
import { demoteMemberEndpoint } from "@/modules/organization/interface/http/demote-member.endpoint.js";
import { findAllEndpoint } from "@/modules/organization/interface/http/find-all.endpoint.js";
import { findInvitationsEndpoint } from "@/modules/organization/interface/http/find-invitations.endpoint.js";
import { findMembersEndpoint } from "@/modules/organization/interface/http/find-members.endpoint.js";
import { findMineEndpoint } from "@/modules/organization/interface/http/find-mine.endpoint.js";
import { inviteEndpoint } from "@/modules/organization/interface/http/invite.endpoint.js";
import { leaveEndpoint } from "@/modules/organization/interface/http/leave.endpoint.js";
import { promoteMemberEndpoint } from "@/modules/organization/interface/http/promote-member.endpoint.js";
import { removeMemberEndpoint } from "@/modules/organization/interface/http/remove-member.endpoint.js";
import { resendInvitationEndpoint } from "@/modules/organization/interface/http/resend-invitation.endpoint.js";
import { restoreEndpoint } from "@/modules/organization/interface/http/restore.endpoint.js";
import { revokeInvitationEndpoint } from "@/modules/organization/interface/http/revoke-invitation.endpoint.js";
import { softDeleteEndpoint } from "@/modules/organization/interface/http/soft-delete.endpoint.js";

// User-facing org operations: create, soft-delete/restore (super-admin),
// invite + revoke (org members), member listing + remove + promote +
// demote (org admins / super-admins), leave (self). All Authz checks
// live inside the endpoints.
export const OrganizationLive = HttpApiBuilder.group(Api, "organization", (handlers) =>
  handlers
    .handle("findMine", findMineEndpoint)
    .handle("create", createEndpoint)
    .handle("softDelete", softDeleteEndpoint)
    .handle("restore", restoreEndpoint)
    .handle("inviteUser", inviteEndpoint)
    .handle("revokeInvitation", revokeInvitationEndpoint)
    .handle("resendInvitation", resendInvitationEndpoint)
    .handle("findInvitations", findInvitationsEndpoint)
    .handle("removeMember", removeMemberEndpoint)
    .handle("findMembers", findMembersEndpoint)
    .handle("promoteMember", promoteMemberEndpoint)
    .handle("demoteMember", demoteMemberEndpoint)
    .handle("leave", leaveEndpoint),
);

// Admin browse of every org. Gated by `Authz.hasPermissions(OrganizationResource, Actions.Read)`
// inside the endpoint, so non-super-admins get 403 before any query
// dispatches. (Member listing moved to `OrganizationLive.findMembers`.)
export const OrganizationAdminLive = HttpApiBuilder.group(Api, "organizationAdmin", (handlers) =>
  handlers.handle("findAll", findAllEndpoint),
);

// Anonymous-friendly accept flow sits in its own group because the URL
// is token-shaped (no org id in path) and the caller isn't yet a member.
export const InvitationLive = HttpApiBuilder.group(Api, "invitations", (handlers) =>
  handlers.handle("accept", acceptInvitationEndpoint),
);
