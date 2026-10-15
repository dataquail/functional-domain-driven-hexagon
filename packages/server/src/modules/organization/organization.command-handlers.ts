import { Command } from "@effect-server-utils/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { MailerLive } from "@/globals/infrastructure/email/adapters/mailer-live";
import { AcceptInvitationCommand } from "@/modules/organization/commands/accept-invitation.command";
import { acceptInvitationHandler } from "@/modules/organization/commands/accept-invitation.handler";
import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization.command";
import { createOrganizationHandler } from "@/modules/organization/commands/create-organization.handler";
import { GrantOrganizationRoleCommand } from "@/modules/organization/commands/grant-organization-role.command";
import { grantOrganizationRoleHandler } from "@/modules/organization/commands/grant-organization-role.handler";
import { InviteUserCommand } from "@/modules/organization/commands/invite-user.command";
import { inviteUserHandler } from "@/modules/organization/commands/invite-user.handler";
import { LeaveOrganizationCommand } from "@/modules/organization/commands/leave-organization.command";
import { leaveOrganizationHandler } from "@/modules/organization/commands/leave-organization.handler";
import { RemoveMemberCommand } from "@/modules/organization/commands/remove-member.command";
import { removeMemberHandler } from "@/modules/organization/commands/remove-member.handler";
import { ResendInvitationCommand } from "@/modules/organization/commands/resend-invitation.command";
import { resendInvitationHandler } from "@/modules/organization/commands/resend-invitation.handler";
import { RestoreOrganizationCommand } from "@/modules/organization/commands/restore-organization.command";
import { restoreOrganizationHandler } from "@/modules/organization/commands/restore-organization.handler";
import { RevokeInvitationCommand } from "@/modules/organization/commands/revoke-invitation.command";
import { revokeInvitationHandler } from "@/modules/organization/commands/revoke-invitation.handler";
import { RevokeOrganizationRoleCommand } from "@/modules/organization/commands/revoke-organization-role.command";
import { revokeOrganizationRoleHandler } from "@/modules/organization/commands/revoke-organization-role.handler";
import { SendInvitationEmailCommand } from "@/modules/organization/commands/send-invitation-email.command";
import { sendInvitationEmailHandler } from "@/modules/organization/commands/send-invitation-email.handler";
import { SoftDeleteOrganizationCommand } from "@/modules/organization/commands/soft-delete-organization.command";
import { softDeleteOrganizationHandler } from "@/modules/organization/commands/soft-delete-organization.handler";
import { PlatformRolesLive } from "@/modules/organization/infrastructure/acl/platform-roles.acl-live";
import { InvitationMailerLive } from "@/modules/organization/infrastructure/clients/invitation-mailer.client-live";
import { InvitationRepositoryLive } from "@/modules/organization/infrastructure/repositories/invitation.repository-live";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/repositories/membership.repository-live";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live";

// `PlatformRolesLive` and `InvitationMailerLive` are provided here rather than at the
// composition root. For the ACL adapter that is a requirement of the design: only a
// dispatch surface can absorb it, because `handlersOf` infers the role-module requirement
// it carries where a hand-written output type would force this module to name it. The
// mailer follows for symmetry — it was only ever hoisted because the invite handler's
// requirement used to reach the endpoints through the bus. It is now the send-email
// handler that names it, reached after commit rather than from the invite path.
export const organizationCommandGroup = Command.group(
  CreateOrganizationCommand,
  AcceptInvitationCommand,
  InviteUserCommand,
  ResendInvitationCommand,
  RevokeInvitationCommand,
  GrantOrganizationRoleCommand,
  RevokeOrganizationRoleCommand,
  LeaveOrganizationCommand,
  RemoveMemberCommand,
  RestoreOrganizationCommand,
  SoftDeleteOrganizationCommand,
  SendInvitationEmailCommand,
);

const OrganizationCommandHandlersLive = Command.handlersOf(organizationCommandGroup, {
  CreateOrganizationCommand: (payload) =>
    createOrganizationHandler(payload).pipe(
      Effect.provide(
        Layer.mergeAll(
          OrganizationRepositoryLive,
          MembershipRepositoryLive,
          OrganizationRolesRepositoryLive,
        ),
      ),
    ),
  AcceptInvitationCommand: (payload) =>
    acceptInvitationHandler(payload).pipe(
      Effect.provide(Layer.mergeAll(InvitationRepositoryLive, MembershipRepositoryLive)),
    ),
  InviteUserCommand: (payload) =>
    inviteUserHandler(payload).pipe(Effect.provide(InvitationRepositoryLive)),
  ResendInvitationCommand: (payload) =>
    resendInvitationHandler(payload).pipe(Effect.provide(InvitationRepositoryLive)),
  RevokeInvitationCommand: (payload) =>
    revokeInvitationHandler(payload).pipe(Effect.provide(InvitationRepositoryLive)),
  GrantOrganizationRoleCommand: (payload) =>
    grantOrganizationRoleHandler(payload).pipe(Effect.provide(OrganizationRolesRepositoryLive)),
  RevokeOrganizationRoleCommand: (payload) =>
    revokeOrganizationRoleHandler(payload).pipe(Effect.provide(OrganizationRolesRepositoryLive)),
  LeaveOrganizationCommand: (payload) =>
    leaveOrganizationHandler(payload).pipe(Effect.provide(MembershipRepositoryLive)),
  RemoveMemberCommand: (payload) =>
    removeMemberHandler(payload).pipe(Effect.provide(MembershipRepositoryLive)),
  RestoreOrganizationCommand: (payload) =>
    restoreOrganizationHandler(payload).pipe(Effect.provide(OrganizationRepositoryLive)),
  SoftDeleteOrganizationCommand: (payload) =>
    softDeleteOrganizationHandler(payload).pipe(Effect.provide(OrganizationRepositoryLive)),
  SendInvitationEmailCommand: (payload) =>
    sendInvitationEmailHandler(payload).pipe(Effect.provide(InvitationRepositoryLive)),
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
