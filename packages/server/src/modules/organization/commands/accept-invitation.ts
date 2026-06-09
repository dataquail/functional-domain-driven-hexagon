import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type AcceptInvitationCommand,
  type AcceptInvitationOutput,
} from "@/modules/organization/commands/accept-invitation-command.js";
import * as Invitation from "@/modules/organization/domain/invitation.aggregate.js";
import { SuperAdminCannotOwnOrganization } from "@/modules/organization/domain/organization-errors.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation-repository.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership-repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { RoleService } from "@/platform/ddd/ports/role-service.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

export const acceptInvitation = (cmd: AcceptInvitationCommand): AcceptInvitationOutput =>
  Effect.gen(function* () {
    // Model invariant: super-admins don't own or join organizations.
    // See `createOrganization` for the rationale on placing this at
    // the use-case level rather than HTTP authz.
    const roles = yield* RoleService;
    const perms = yield* roles.findPlatformPermissions(cmd.userId);
    if (perms.roles.includes("super_admin")) {
      return yield* Effect.fail(new SuperAdminCannotOwnOrganization({ userId: cmd.userId }));
    }

    const invRepo = yield* InvitationRepository;
    const memberRepo = yield* MembershipRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;
    const now = yield* DateTime.now;

    const invitation = yield* invRepo.findByToken(cmd.token);
    const result = yield* Invitation.accept(invitation, { userId: cmd.userId, now });
    yield* Effect.annotateCurrentSpan("invitation.id", invitation.id);
    yield* Effect.annotateCurrentSpan("organization.id", invitation.organizationId);

    yield* uow
      .run(
        Effect.gen(function* () {
          yield* invRepo.update(result.invitation);
          yield* memberRepo.insert(result.membership);
          yield* bus.dispatch(result.events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
    // Concurrent revoke between findByToken and update would surface as
    // InvitationNotFound from `update` — treat as a defect (the token
    // was valid moments ago; the operator should look at the trace).
    // For normal use, the aggregate's accept() catches expired/revoked.

    return invitation.organizationId;
  }).pipe(Effect.catchTag("InvitationNotFound", Effect.die));
