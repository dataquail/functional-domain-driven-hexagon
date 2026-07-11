import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type AcceptInvitationCommand,
  acceptInvitationCommandSpanAttributes,
} from "@/modules/organization/commands/accept-invitation.command.js";
import { acceptInvitation } from "@/modules/organization/commands/accept-invitation.handler.js";
import {
  type CreateOrganizationCommand,
  createOrganizationCommandSpanAttributes,
} from "@/modules/organization/commands/create-organization.command.js";
import { createOrganization } from "@/modules/organization/commands/create-organization.handler.js";
import {
  type GrantOrganizationRoleCommand,
  grantOrganizationRoleCommandSpanAttributes,
} from "@/modules/organization/commands/grant-organization-role.command.js";
import { grantOrganizationRole } from "@/modules/organization/commands/grant-organization-role.handler.js";
import {
  type InviteUserCommand,
  inviteUserCommandSpanAttributes,
} from "@/modules/organization/commands/invite-user.command.js";
import { inviteUser } from "@/modules/organization/commands/invite-user.handler.js";
import {
  type LeaveOrganizationCommand,
  leaveOrganizationCommandSpanAttributes,
} from "@/modules/organization/commands/leave-organization.command.js";
import { leaveOrganization } from "@/modules/organization/commands/leave-organization.handler.js";
import {
  type RemoveMemberCommand,
  removeMemberCommandSpanAttributes,
} from "@/modules/organization/commands/remove-member.command.js";
import { removeMember } from "@/modules/organization/commands/remove-member.handler.js";
import {
  type ResendInvitationCommand,
  resendInvitationCommandSpanAttributes,
} from "@/modules/organization/commands/resend-invitation.command.js";
import { resendInvitation } from "@/modules/organization/commands/resend-invitation.handler.js";
import {
  type RestoreOrganizationCommand,
  restoreOrganizationCommandSpanAttributes,
} from "@/modules/organization/commands/restore-organization.command.js";
import { restoreOrganization } from "@/modules/organization/commands/restore-organization.handler.js";
import {
  type RevokeInvitationCommand,
  revokeInvitationCommandSpanAttributes,
} from "@/modules/organization/commands/revoke-invitation.command.js";
import { revokeInvitation } from "@/modules/organization/commands/revoke-invitation.handler.js";
import {
  type RevokeOrganizationRoleCommand,
  revokeOrganizationRoleCommandSpanAttributes,
} from "@/modules/organization/commands/revoke-organization-role.command.js";
import { revokeOrganizationRole } from "@/modules/organization/commands/revoke-organization-role.handler.js";
import {
  type SoftDeleteOrganizationCommand,
  softDeleteOrganizationCommandSpanAttributes,
} from "@/modules/organization/commands/soft-delete-organization.command.js";
import { softDeleteOrganization } from "@/modules/organization/commands/soft-delete-organization.handler.js";
import {
  type InvitationAlreadyAccepted,
  type InvitationAlreadyRevoked,
  type InvitationExpired,
  type InvitationNotFound,
  type InvitationRevoked,
  type InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation/invitation.errors.js";
import { type MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import {
  type OrganizationAlreadyDeleted,
  type OrganizationNotDeleted,
  type OrganizationNotFound,
  type SuperAdminCannotOwnOrganization,
} from "@/modules/organization/domain/organization/organization.errors.js";
import {
  type AlreadyHasOrganizationRole,
  type CannotPromoteSelfInOrganization,
  type DoesNotHaveOrganizationRole,
} from "@/modules/organization/domain/organization-roles/organization-role.errors.js";
import { type InvitationMailer } from "@/modules/organization/domain/ports/clients/invitation-mailer.client.js";
import { InvitationRepositoryLive } from "@/modules/organization/infrastructure/repositories/invitation.repository-live.js";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/repositories/membership.repository-live.js";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live.js";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { commandHandlers } from "@/platform/ddd/ports/command-bus.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type RoleService } from "@/platform/ddd/ports/role-service.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { type InvitationId } from "@/platform/ids/invitation-id.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// `RoleService` stays in the bus output's R because the model-invariant
// check (super-admins can't own orgs) needs the platform-role ACL. The
// composition root wires `RoleServiceLive` alongside the module Live.
type CreateOrganizationOutput = Effect.Effect<
  OrganizationId,
  PersistenceUnavailable | SuperAdminCannotOwnOrganization,
  DomainEventBus | UnitOfWork | Database.Database | RoleService
>;

type RestoreOrganizationOutput = Effect.Effect<
  void,
  OrganizationNotFound | OrganizationNotDeleted | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type SoftDeleteOrganizationOutput = Effect.Effect<
  void,
  OrganizationNotFound | OrganizationAlreadyDeleted | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type RemoveMemberOutput = Effect.Effect<
  void,
  MembershipNotFound | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type LeaveOrganizationOutput = Effect.Effect<
  void,
  MembershipNotFound | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

// `InvitationMailer` stays in R (provided by `OrganizationModuleLive`,
// which wires the env-selected transport behind it) — the same shape as
// the `UsersLookup` outbound adapter on the query side.
type InviteUserOutput = Effect.Effect<
  InvitationId,
  PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database | InvitationMailer
>;

type AcceptInvitationOutput = Effect.Effect<
  OrganizationId,
  | InvitationTokenNotFound
  | InvitationAlreadyAccepted
  | InvitationRevoked
  | InvitationExpired
  | SuperAdminCannotOwnOrganization
  | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database | RoleService
>;

type RevokeInvitationOutput = Effect.Effect<
  void,
  | InvitationNotFound
  | InvitationAlreadyAccepted
  | InvitationAlreadyRevoked
  | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

// `InvitationMailer` stays in R (provided by `OrganizationModuleLive`) —
// resend re-sends the email after the reissue commits.
type ResendInvitationOutput = Effect.Effect<
  void,
  | InvitationNotFound
  | InvitationAlreadyAccepted
  | InvitationAlreadyRevoked
  | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database | InvitationMailer
>;

type GrantOrganizationRoleOutput = Effect.Effect<
  void,
  AlreadyHasOrganizationRole | CannotPromoteSelfInOrganization | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type RevokeOrganizationRoleOutput = Effect.Effect<
  void,
  DoesNotHaveOrganizationRole | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

declare module "@/platform/ddd/ports/command-bus.js" {
  interface CommandRegistry {
    CreateOrganizationCommand: {
      readonly command: CreateOrganizationCommand;
      readonly output: CreateOrganizationOutput;
    };
    RestoreOrganizationCommand: {
      readonly command: RestoreOrganizationCommand;
      readonly output: RestoreOrganizationOutput;
    };
    SoftDeleteOrganizationCommand: {
      readonly command: SoftDeleteOrganizationCommand;
      readonly output: SoftDeleteOrganizationOutput;
    };
    RemoveMemberCommand: {
      readonly command: RemoveMemberCommand;
      readonly output: RemoveMemberOutput;
    };
    LeaveOrganizationCommand: {
      readonly command: LeaveOrganizationCommand;
      readonly output: LeaveOrganizationOutput;
    };
    InviteUserCommand: {
      readonly command: InviteUserCommand;
      readonly output: InviteUserOutput;
    };
    AcceptInvitationCommand: {
      readonly command: AcceptInvitationCommand;
      readonly output: AcceptInvitationOutput;
    };
    RevokeInvitationCommand: {
      readonly command: RevokeInvitationCommand;
      readonly output: RevokeInvitationOutput;
    };
    ResendInvitationCommand: {
      readonly command: ResendInvitationCommand;
      readonly output: ResendInvitationOutput;
    };
    GrantOrganizationRoleCommand: {
      readonly command: GrantOrganizationRoleCommand;
      readonly output: GrantOrganizationRoleOutput;
    };
    RevokeOrganizationRoleCommand: {
      readonly command: RevokeOrganizationRoleCommand;
      readonly output: RevokeOrganizationRoleOutput;
    };
  }
}

export const organizationCommandHandlers = commandHandlers({
  CreateOrganizationCommand: {
    handle: (cmd): CreateOrganizationOutput =>
      createOrganization(cmd).pipe(
        Effect.provide(
          Layer.mergeAll(
            OrganizationRepositoryLive,
            MembershipRepositoryLive,
            OrganizationRolesRepositoryLive,
          ),
        ),
      ),
    spanAttributes: createOrganizationCommandSpanAttributes,
  },
  SoftDeleteOrganizationCommand: {
    handle: (cmd): SoftDeleteOrganizationOutput =>
      softDeleteOrganization(cmd).pipe(Effect.provide(OrganizationRepositoryLive)),
    spanAttributes: softDeleteOrganizationCommandSpanAttributes,
  },
  RestoreOrganizationCommand: {
    handle: (cmd): RestoreOrganizationOutput =>
      restoreOrganization(cmd).pipe(Effect.provide(OrganizationRepositoryLive)),
    spanAttributes: restoreOrganizationCommandSpanAttributes,
  },
  RemoveMemberCommand: {
    handle: (cmd): RemoveMemberOutput =>
      removeMember(cmd).pipe(Effect.provide(MembershipRepositoryLive)),
    spanAttributes: removeMemberCommandSpanAttributes,
  },
  LeaveOrganizationCommand: {
    handle: (cmd): LeaveOrganizationOutput =>
      leaveOrganization(cmd).pipe(Effect.provide(MembershipRepositoryLive)),
    spanAttributes: leaveOrganizationCommandSpanAttributes,
  },
  InviteUserCommand: {
    handle: (cmd): InviteUserOutput =>
      inviteUser(cmd).pipe(Effect.provide(InvitationRepositoryLive)),
    spanAttributes: inviteUserCommandSpanAttributes,
  },
  AcceptInvitationCommand: {
    handle: (cmd): AcceptInvitationOutput =>
      acceptInvitation(cmd).pipe(
        Effect.provide(Layer.mergeAll(InvitationRepositoryLive, MembershipRepositoryLive)),
      ),
    spanAttributes: acceptInvitationCommandSpanAttributes,
  },
  RevokeInvitationCommand: {
    handle: (cmd): RevokeInvitationOutput =>
      revokeInvitation(cmd).pipe(Effect.provide(InvitationRepositoryLive)),
    spanAttributes: revokeInvitationCommandSpanAttributes,
  },
  ResendInvitationCommand: {
    handle: (cmd): ResendInvitationOutput =>
      resendInvitation(cmd).pipe(Effect.provide(InvitationRepositoryLive)),
    spanAttributes: resendInvitationCommandSpanAttributes,
  },
  GrantOrganizationRoleCommand: {
    handle: (cmd): GrantOrganizationRoleOutput =>
      grantOrganizationRole(cmd).pipe(Effect.provide(OrganizationRolesRepositoryLive)),
    spanAttributes: grantOrganizationRoleCommandSpanAttributes,
  },
  RevokeOrganizationRoleCommand: {
    handle: (cmd): RevokeOrganizationRoleOutput =>
      revokeOrganizationRole(cmd).pipe(Effect.provide(OrganizationRolesRepositoryLive)),
    spanAttributes: revokeOrganizationRoleCommandSpanAttributes,
  },
});
