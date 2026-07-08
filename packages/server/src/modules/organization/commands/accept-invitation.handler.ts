import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type AcceptInvitationCommand } from "@/modules/organization/commands/accept-invitation.command.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation.root.js";
import { SuperAdminCannotOwnOrganization } from "@/modules/organization/domain/organization.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation.repository.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership.repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { RoleService } from "@/platform/ddd/ports/role-service.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const acceptInvitation = Effect.fn("acceptInvitation")(
  function* (cmd: AcceptInvitationCommand) {
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
    const now = yield* DateTime.now;

    const invitation = yield* invRepo.findOneByToken(cmd.token);
    const result = yield* Effect.fromResult(
      InvitationRootOps.accept(invitation, { userId: cmd.userId, now }),
    );
    yield* Effect.annotateCurrentSpan("invitation.id", invitation.id);
    yield* Effect.annotateCurrentSpan("organization.id", invitation.organizationId);

    yield* invRepo.updateOne(result.invitation);
    yield* memberRepo.insertOne(result.membership);
    yield* bus.dispatch(result.events);
    // Concurrent revoke between findOneByToken and update would surface as
    // InvitationNotFound from `update` — treat as a defect (the token
    // was valid moments ago; the operator should look at the trace).
    // For normal use, the aggregate's accept() catches expired/revoked.

    return invitation.organizationId;
  },
  withUnitOfWork,
  Effect.catchTag("InvitationNotFound", Effect.die),
);
