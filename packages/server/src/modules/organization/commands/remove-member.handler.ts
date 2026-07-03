import * as Effect from "effect/Effect";

import {
  type RemoveMemberCommand,
  type RemoveMemberOutput,
} from "@/modules/organization/commands/remove-member.command.js";
import { MembershipRootOps } from "@/modules/organization/domain/membership.root.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership.repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const removeMember = (cmd: RemoveMemberCommand): RemoveMemberOutput =>
  Effect.gen(function* () {
    const repo = yield* MembershipRepository;
    const bus = yield* DomainEventBus;
    const membership = yield* repo.findOneByUserIdAndOrgId(cmd.targetUserId, cmd.organizationId);
    const { events } = MembershipRootOps.revoke(membership);
    yield* repo.deleteOne(cmd.targetUserId, cmd.organizationId);
    yield* bus.dispatch(events);
  }).pipe(withUnitOfWork);
