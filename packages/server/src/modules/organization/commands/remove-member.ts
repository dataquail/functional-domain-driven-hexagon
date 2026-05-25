import * as Effect from "effect/Effect";

import {
  type RemoveMemberCommand,
  type RemoveMemberOutput,
} from "@/modules/organization/commands/remove-member-command.js";
import * as Membership from "@/modules/organization/domain/membership.aggregate.js";
import { MembershipRepository } from "@/modules/organization/domain/membership-repository.js";
import { DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

export const removeMember = (cmd: RemoveMemberCommand): RemoveMemberOutput =>
  Effect.gen(function* () {
    const repo = yield* MembershipRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;
    const membership = yield* repo.findByUserIdAndOrgId(cmd.targetUserId, cmd.organizationId);
    const { events } = Membership.revoke(membership);
    yield* uow
      .run(
        Effect.gen(function* () {
          yield* repo.delete(cmd.targetUserId, cmd.organizationId);
          yield* bus.dispatch(events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
  });
