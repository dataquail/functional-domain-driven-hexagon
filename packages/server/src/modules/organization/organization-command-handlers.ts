import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { acceptInvitation } from "@/modules/organization/commands/accept-invitation.js";
import {
  type AcceptInvitationCommand,
  acceptInvitationCommandSpanAttributes,
} from "@/modules/organization/commands/accept-invitation-command.js";
import { createOrganization } from "@/modules/organization/commands/create-organization.js";
import {
  type CreateOrganizationCommand,
  createOrganizationCommandSpanAttributes,
} from "@/modules/organization/commands/create-organization-command.js";
import { grantOrganizationRole } from "@/modules/organization/commands/grant-organization-role.js";
import {
  type GrantOrganizationRoleCommand,
  grantOrganizationRoleCommandSpanAttributes,
} from "@/modules/organization/commands/grant-organization-role-command.js";
import { inviteUser } from "@/modules/organization/commands/invite-user.js";
import {
  type InviteUserCommand,
  inviteUserCommandSpanAttributes,
} from "@/modules/organization/commands/invite-user-command.js";
import { leaveOrganization } from "@/modules/organization/commands/leave-organization.js";
import {
  type LeaveOrganizationCommand,
  leaveOrganizationCommandSpanAttributes,
} from "@/modules/organization/commands/leave-organization-command.js";
import { removeMember } from "@/modules/organization/commands/remove-member.js";
import {
  type RemoveMemberCommand,
  removeMemberCommandSpanAttributes,
} from "@/modules/organization/commands/remove-member-command.js";
import { restoreOrganization } from "@/modules/organization/commands/restore-organization.js";
import {
  type RestoreOrganizationCommand,
  restoreOrganizationCommandSpanAttributes,
} from "@/modules/organization/commands/restore-organization-command.js";
import { revokeInvitation } from "@/modules/organization/commands/revoke-invitation.js";
import {
  type RevokeInvitationCommand,
  revokeInvitationCommandSpanAttributes,
} from "@/modules/organization/commands/revoke-invitation-command.js";
import { revokeOrganizationRole } from "@/modules/organization/commands/revoke-organization-role.js";
import {
  type RevokeOrganizationRoleCommand,
  revokeOrganizationRoleCommandSpanAttributes,
} from "@/modules/organization/commands/revoke-organization-role-command.js";
import { softDeleteOrganization } from "@/modules/organization/commands/soft-delete-organization.js";
import {
  type SoftDeleteOrganizationCommand,
  softDeleteOrganizationCommandSpanAttributes,
} from "@/modules/organization/commands/soft-delete-organization-command.js";
import {
  type InvitationAlreadyAccepted,
  type InvitationAlreadyRevoked,
  type InvitationExpired,
  type InvitationNotFound,
  type InvitationRevoked,
  type InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation-errors.js";
import { type MembershipNotFound } from "@/modules/organization/domain/membership-errors.js";
import {
  type OrganizationAlreadyDeleted,
  type OrganizationNotDeleted,
  type OrganizationNotFound,
  type SuperAdminCannotOwnOrganization,
} from "@/modules/organization/domain/organization-errors.js";
import {
  type AlreadyHasOrganizationRole,
  type CannotPromoteSelfInOrganization,
  type DoesNotHaveOrganizationRole,
} from "@/modules/organization/domain/organization-role-errors.js";
import { type InvitationMailer } from "@/modules/organization/domain/ports/external/invitation-mailer.js";
import { InvitationRepositoryLive } from "@/modules/organization/infrastructure/invitation-repository-live.js";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/membership-repository-live.js";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/organization-repository-live.js";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/organization-roles-repository-live.js";
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
type CreateOrganizationBusOutput = Effect.Effect<
  OrganizationId,
  PersistenceUnavailable | SuperAdminCannotOwnOrganization,
  DomainEventBus | UnitOfWork | Database.Database | RoleService
>;

type RestoreOrganizationBusOutput = Effect.Effect<
  void,
  OrganizationNotFound | OrganizationNotDeleted | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type SoftDeleteOrganizationBusOutput = Effect.Effect<
  void,
  OrganizationNotFound | OrganizationAlreadyDeleted | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type RemoveMemberBusOutput = Effect.Effect<
  void,
  MembershipNotFound | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type LeaveOrganizationBusOutput = Effect.Effect<
  void,
  MembershipNotFound | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

// `InvitationMailer` stays in R (provided by `OrganizationModuleLive`,
// which wires the env-selected transport behind it) — the same shape as
// the `UsersLookup` outbound adapter on the query side.
type InviteUserBusOutput = Effect.Effect<
  InvitationId,
  PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database | InvitationMailer
>;

type AcceptInvitationBusOutput = Effect.Effect<
  OrganizationId,
  | InvitationTokenNotFound
  | InvitationAlreadyAccepted
  | InvitationRevoked
  | InvitationExpired
  | SuperAdminCannotOwnOrganization
  | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database | RoleService
>;

type RevokeInvitationBusOutput = Effect.Effect<
  void,
  | InvitationNotFound
  | InvitationAlreadyAccepted
  | InvitationAlreadyRevoked
  | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type GrantOrganizationRoleBusOutput = Effect.Effect<
  void,
  AlreadyHasOrganizationRole | CannotPromoteSelfInOrganization | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

type RevokeOrganizationRoleBusOutput = Effect.Effect<
  void,
  DoesNotHaveOrganizationRole | PersistenceUnavailable,
  DomainEventBus | UnitOfWork | Database.Database
>;

declare module "@/platform/ddd/ports/command-bus.js" {
  interface CommandRegistry {
    CreateOrganizationCommand: {
      readonly command: CreateOrganizationCommand;
      readonly output: CreateOrganizationBusOutput;
    };
    RestoreOrganizationCommand: {
      readonly command: RestoreOrganizationCommand;
      readonly output: RestoreOrganizationBusOutput;
    };
    SoftDeleteOrganizationCommand: {
      readonly command: SoftDeleteOrganizationCommand;
      readonly output: SoftDeleteOrganizationBusOutput;
    };
    RemoveMemberCommand: {
      readonly command: RemoveMemberCommand;
      readonly output: RemoveMemberBusOutput;
    };
    LeaveOrganizationCommand: {
      readonly command: LeaveOrganizationCommand;
      readonly output: LeaveOrganizationBusOutput;
    };
    InviteUserCommand: {
      readonly command: InviteUserCommand;
      readonly output: InviteUserBusOutput;
    };
    AcceptInvitationCommand: {
      readonly command: AcceptInvitationCommand;
      readonly output: AcceptInvitationBusOutput;
    };
    RevokeInvitationCommand: {
      readonly command: RevokeInvitationCommand;
      readonly output: RevokeInvitationBusOutput;
    };
    GrantOrganizationRoleCommand: {
      readonly command: GrantOrganizationRoleCommand;
      readonly output: GrantOrganizationRoleBusOutput;
    };
    RevokeOrganizationRoleCommand: {
      readonly command: RevokeOrganizationRoleCommand;
      readonly output: RevokeOrganizationRoleBusOutput;
    };
  }
}

export const organizationCommandHandlers = commandHandlers({
  CreateOrganizationCommand: {
    handle: (cmd): CreateOrganizationBusOutput =>
      createOrganization(cmd).pipe(
        Effect.provide(OrganizationRepositoryLive),
        Effect.provide(MembershipRepositoryLive),
        Effect.provide(OrganizationRolesRepositoryLive),
      ),
    spanAttributes: createOrganizationCommandSpanAttributes,
  },
  SoftDeleteOrganizationCommand: {
    handle: (cmd): SoftDeleteOrganizationBusOutput =>
      softDeleteOrganization(cmd).pipe(Effect.provide(OrganizationRepositoryLive)),
    spanAttributes: softDeleteOrganizationCommandSpanAttributes,
  },
  RestoreOrganizationCommand: {
    handle: (cmd): RestoreOrganizationBusOutput =>
      restoreOrganization(cmd).pipe(Effect.provide(OrganizationRepositoryLive)),
    spanAttributes: restoreOrganizationCommandSpanAttributes,
  },
  RemoveMemberCommand: {
    handle: (cmd): RemoveMemberBusOutput =>
      removeMember(cmd).pipe(Effect.provide(MembershipRepositoryLive)),
    spanAttributes: removeMemberCommandSpanAttributes,
  },
  LeaveOrganizationCommand: {
    handle: (cmd): LeaveOrganizationBusOutput =>
      leaveOrganization(cmd).pipe(Effect.provide(MembershipRepositoryLive)),
    spanAttributes: leaveOrganizationCommandSpanAttributes,
  },
  InviteUserCommand: {
    handle: (cmd): InviteUserBusOutput =>
      inviteUser(cmd).pipe(Effect.provide(InvitationRepositoryLive)),
    spanAttributes: inviteUserCommandSpanAttributes,
  },
  AcceptInvitationCommand: {
    handle: (cmd): AcceptInvitationBusOutput =>
      acceptInvitation(cmd).pipe(
        Effect.provide(InvitationRepositoryLive),
        Effect.provide(MembershipRepositoryLive),
      ),
    spanAttributes: acceptInvitationCommandSpanAttributes,
  },
  RevokeInvitationCommand: {
    handle: (cmd): RevokeInvitationBusOutput =>
      revokeInvitation(cmd).pipe(Effect.provide(InvitationRepositoryLive)),
    spanAttributes: revokeInvitationCommandSpanAttributes,
  },
  GrantOrganizationRoleCommand: {
    handle: (cmd): GrantOrganizationRoleBusOutput =>
      grantOrganizationRole(cmd).pipe(Effect.provide(OrganizationRolesRepositoryLive)),
    spanAttributes: grantOrganizationRoleCommandSpanAttributes,
  },
  RevokeOrganizationRoleCommand: {
    handle: (cmd): RevokeOrganizationRoleBusOutput =>
      revokeOrganizationRole(cmd).pipe(Effect.provide(OrganizationRolesRepositoryLive)),
    spanAttributes: revokeOrganizationRoleCommandSpanAttributes,
  },
});
