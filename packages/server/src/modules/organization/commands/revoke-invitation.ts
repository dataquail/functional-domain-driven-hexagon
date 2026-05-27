import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type RevokeInvitationCommand,
  type RevokeInvitationOutput,
} from "@/modules/organization/commands/revoke-invitation-command.js";
import * as Invitation from "@/modules/organization/domain/invitation.aggregate.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation-repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

export const revokeInvitation = (cmd: RevokeInvitationCommand): RevokeInvitationOutput =>
  Effect.gen(function* () {
    const repo = yield* InvitationRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;
    const now = yield* DateTime.now;
    const invitation = yield* repo.findById(cmd.invitationId);
    const result = yield* Invitation.revoke(invitation, { now });
    yield* uow
      .run(
        Effect.gen(function* () {
          yield* repo.update(result.invitation);
          yield* bus.dispatch(result.events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
  });
