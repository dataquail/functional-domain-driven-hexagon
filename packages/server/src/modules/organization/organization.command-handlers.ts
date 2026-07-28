import { Command } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { AcceptInvitation } from "@/modules/organization/commands/accept-invitation.command.js";
import { acceptInvitation } from "@/modules/organization/commands/accept-invitation.handler.js";
import { CreateOrganization } from "@/modules/organization/commands/create-organization.command.js";
import { createOrganization } from "@/modules/organization/commands/create-organization.handler.js";
import { GrantOrganizationRole } from "@/modules/organization/commands/grant-organization-role.command.js";
import { grantOrganizationRole } from "@/modules/organization/commands/grant-organization-role.handler.js";
import { InviteUser } from "@/modules/organization/commands/invite-user.command.js";
import { inviteUser } from "@/modules/organization/commands/invite-user.handler.js";
import { LeaveOrganization } from "@/modules/organization/commands/leave-organization.command.js";
import { leaveOrganization } from "@/modules/organization/commands/leave-organization.handler.js";
import { RemoveMember } from "@/modules/organization/commands/remove-member.command.js";
import { removeMember } from "@/modules/organization/commands/remove-member.handler.js";
import { ResendInvitation } from "@/modules/organization/commands/resend-invitation.command.js";
import { resendInvitation } from "@/modules/organization/commands/resend-invitation.handler.js";
import { RestoreOrganization } from "@/modules/organization/commands/restore-organization.command.js";
import { restoreOrganization } from "@/modules/organization/commands/restore-organization.handler.js";
import { RevokeInvitation } from "@/modules/organization/commands/revoke-invitation.command.js";
import { revokeInvitation } from "@/modules/organization/commands/revoke-invitation.handler.js";
import { RevokeOrganizationRole } from "@/modules/organization/commands/revoke-organization-role.command.js";
import { revokeOrganizationRole } from "@/modules/organization/commands/revoke-organization-role.handler.js";
import { SoftDeleteOrganization } from "@/modules/organization/commands/soft-delete-organization.command.js";
import { softDeleteOrganization } from "@/modules/organization/commands/soft-delete-organization.handler.js";
import { PlatformRolesLive } from "@/modules/organization/infrastructure/acl/platform-roles.acl-live.js";
import { InvitationMailerLive } from "@/modules/organization/infrastructure/clients/invitation-mailer.client-live.js";
import { InvitationRepositoryLive } from "@/modules/organization/infrastructure/repositories/invitation.repository-live.js";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/repositories/membership.repository-live.js";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live.js";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live.js";
import { MailerLive } from "@/platform/notifications/mailer-live.js";

// `PlatformRolesLive` and `InvitationMailerLive` are provided here rather than at the
// composition root. For the ACL adapter that is a requirement of the design: only a
// dispatch surface can absorb it, because `handlersOf` infers the role-module requirement
// it carries where a hand-written output type would force this module to name it. The
// mailer follows for symmetry — it was only ever hoisted because the invite handler's
// requirement used to reach the endpoints through the bus.
const organizationCommandGroup = Command.group(
  CreateOrganization,
  AcceptInvitation,
  InviteUser,
  ResendInvitation,
  RevokeInvitation,
  GrantOrganizationRole,
  RevokeOrganizationRole,
  LeaveOrganization,
  RemoveMember,
  RestoreOrganization,
  SoftDeleteOrganization,
);

const OrganizationCommandHandlersLive = Command.handlersOf(organizationCommandGroup, {
  CreateOrganizationCommand: (payload) =>
    createOrganization(payload).pipe(
      Effect.provide(
        Layer.mergeAll(
          OrganizationRepositoryLive,
          MembershipRepositoryLive,
          OrganizationRolesRepositoryLive,
        ),
      ),
    ),
  AcceptInvitationCommand: (payload) =>
    acceptInvitation(payload).pipe(
      Effect.provide(Layer.mergeAll(InvitationRepositoryLive, MembershipRepositoryLive)),
    ),
  InviteUserCommand: (payload) =>
    inviteUser(payload).pipe(Effect.provide(InvitationRepositoryLive)),
  ResendInvitationCommand: (payload) =>
    resendInvitation(payload).pipe(Effect.provide(InvitationRepositoryLive)),
  RevokeInvitationCommand: (payload) =>
    revokeInvitation(payload).pipe(Effect.provide(InvitationRepositoryLive)),
  GrantOrganizationRoleCommand: (payload) =>
    grantOrganizationRole(payload).pipe(Effect.provide(OrganizationRolesRepositoryLive)),
  RevokeOrganizationRoleCommand: (payload) =>
    revokeOrganizationRole(payload).pipe(Effect.provide(OrganizationRolesRepositoryLive)),
  LeaveOrganizationCommand: (payload) =>
    leaveOrganization(payload).pipe(Effect.provide(MembershipRepositoryLive)),
  RemoveMemberCommand: (payload) =>
    removeMember(payload).pipe(Effect.provide(MembershipRepositoryLive)),
  RestoreOrganizationCommand: (payload) =>
    restoreOrganization(payload).pipe(Effect.provide(OrganizationRepositoryLive)),
  SoftDeleteOrganizationCommand: (payload) =>
    softDeleteOrganization(payload).pipe(Effect.provide(OrganizationRepositoryLive)),
}).pipe(
  Layer.provide(
    Layer.mergeAll(PlatformRolesLive, InvitationMailerLive.pipe(Layer.provide(MailerLive))),
  ),
);

// Two payload fields are deliberately absent: the invitation token is a bearer
// credential and `inviteeEmail` is PII. Each handler annotates the resolved invitation id
// itself, which is post-redaction and safe.
const organizationCommandSpanAttributes: Command.SpanAttributes<typeof organizationCommandGroup> = {
  CreateOrganizationCommand: (payload) => ({
    "organization.name": payload.name,
    "actor.user.id": payload.actorUserId,
  }),
  AcceptInvitationCommand: (payload) => ({ "user.id": payload.userId }),
  InviteUserCommand: (payload) => ({
    "organization.id": payload.organizationId,
    "actor.user.id": payload.actorUserId,
  }),
  ResendInvitationCommand: (payload) => ({
    "invitation.id": payload.invitationId,
    "actor.user.id": payload.actorUserId,
  }),
  RevokeInvitationCommand: (payload) => ({
    "invitation.id": payload.invitationId,
    "actor.user.id": payload.actorUserId,
  }),
  GrantOrganizationRoleCommand: (payload) => ({
    "user.id": payload.userId,
    "organization.id": payload.organizationId,
    "organization.role": payload.role,
    "actor.user.id": payload.actorUserId,
  }),
  RevokeOrganizationRoleCommand: (payload) => ({
    "user.id": payload.userId,
    "organization.id": payload.organizationId,
    "organization.role": payload.role,
  }),
  LeaveOrganizationCommand: (payload) => ({
    "user.id": payload.userId,
    "organization.id": payload.organizationId,
  }),
  RemoveMemberCommand: (payload) => ({
    "target.user.id": payload.targetUserId,
    "organization.id": payload.organizationId,
    "actor.user.id": payload.actorUserId,
  }),
  RestoreOrganizationCommand: (payload) => ({ "organization.id": payload.organizationId }),
  SoftDeleteOrganizationCommand: (payload) => ({ "organization.id": payload.organizationId }),
};

// This module's slice of the write-side dispatch surface. See `WalletCommands` for why
// a module publishes its own surface rather than letting consumers name the bus.
export class OrganizationCommands extends Context.Service<
  OrganizationCommands,
  Command.Dispatcher<typeof organizationCommandGroup>
>()("@org/server/organization/OrganizationCommands") {}

export const OrganizationCommandsLive = Layer.effect(
  OrganizationCommands,
  Command.dispatcher(organizationCommandGroup, {
    spanAttributes: organizationCommandSpanAttributes,
  }),
).pipe(Layer.provide(OrganizationCommandHandlersLive));
