import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { DomainEventBus } from "@/globals/application/ports/event-bus.ts";
import { type RevokeInvitationPayload } from "@/modules/organization/commands/revoke-invitation.command.ts";
import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.ts";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.ts";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.ts";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.ts";

export const revokeInvitationHandler = Effect.fn("revokeInvitationHandler")(function* (
  cmd: RevokeInvitationPayload,
) {
  const repo = yield* InvitationRepository;
  const bus = yield* DomainEventBus;
  const now = yield* DateTime.now;
  const maybeInvitation = yield* repo.findOne(InvitationSpecifications.withId(cmd.invitationId));

  if (Option.isNone(maybeInvitation)) {
    return yield* new InvitationNotFound({ invitationId: cmd.invitationId });
  }

  const invitation = maybeInvitation.value;

  const result = yield* Effect.fromResult(InvitationRootOps.revoke(invitation, { now }));
  yield* repo.updateOne(result.invitation);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
