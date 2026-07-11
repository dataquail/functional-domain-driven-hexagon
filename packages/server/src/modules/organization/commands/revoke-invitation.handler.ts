import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type RevokeInvitationCommand } from "@/modules/organization/commands/revoke-invitation.command.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const revokeInvitation = Effect.fn("revokeInvitation")(function* (
  cmd: RevokeInvitationCommand,
) {
  const repo = yield* InvitationRepository;
  const bus = yield* DomainEventBus;
  const now = yield* DateTime.now;
  const invitation = yield* repo.findOneById(cmd.invitationId);
  const result = yield* Effect.fromResult(InvitationRootOps.revoke(invitation, { now }));
  yield* repo.updateOne(result.invitation);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
