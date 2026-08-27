import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type AcceptInvitationPayload } from "@/modules/organization/commands/accept-invitation.command.js";
import { InvitationAcceptance } from "@/modules/organization/domain/domain-services/invitation-acceptance.domain-service.js";
import { InvitationTokenNotFound } from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.js";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.js";
import { SuperAdminCannotOwnOrganization } from "@/modules/organization/domain/organization/organization.errors.js";
import { PlatformRoles } from "@/modules/organization/domain/ports/acl/platform-roles.acl.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";

export const acceptInvitationHandler = Effect.fn("acceptInvitationHandler")(
  function* (cmd: AcceptInvitationPayload) {
    // Model invariant: super-admins don't own or join organizations.
    // See `createOrganizationHandler` for the rationale on placing this at
    // the use-case level rather than HTTP authz.
    const roles = yield* PlatformRoles;
    if (yield* roles.isSuperAdmin(cmd.userId)) {
      return yield* new SuperAdminCannotOwnOrganization({ userId: cmd.userId });
    }

    const invRepo = yield* InvitationRepository;
    const memberRepo = yield* MembershipRepository;
    const bus = yield* DomainEventBus;
    const now = yield* DateTime.now;

    const invitation = yield* invRepo.findOne(InvitationSpecifications.withToken(cmd.token));
    if (invitation === null) {
      return yield* new InvitationTokenNotFound();
    }
    const result = yield* Effect.fromResult(
      InvitationAcceptance.accept(invitation, { userId: cmd.userId, now }),
    );
    yield* Effect.annotateCurrentSpan("invitation.id", invitation.id);
    yield* Effect.annotateCurrentSpan("organization.id", invitation.organizationId);

    yield* invRepo.updateOne(result.invitation);
    yield* memberRepo.insertOne(result.membership);
    yield* bus.dispatch(result.events);
    // Concurrent revoke between the findOne(withToken) read and update would
    // surface as InvitationNotFound from `update` — treat as a defect (the
    // token was valid moments ago; the operator should look at the trace).
    // For normal use, the aggregate's accept() catches expired/revoked.

    return invitation.organizationId;
  },
  withUnitOfWork,
  Effect.catchTag("InvitationNotFound", Effect.die),
);
