import * as Effect from "effect/Effect";

import { type RemoveMemberCommand } from "@/modules/organization/commands/remove-member.command.js";
import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.js";
import { MembershipRootOps } from "@/modules/organization/domain/membership/membership.root-ops.js";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const removeMember = Effect.fn("removeMember")(function* (cmd: RemoveMemberCommand) {
  const repo = yield* MembershipRepository;
  const bus = yield* DomainEventBus;
  const membership = yield* repo.findOne(
    Spec.and(
      MembershipSpecifications.forUser(cmd.targetUserId),
      MembershipSpecifications.forOrganization(cmd.organizationId),
    ),
  );
  if (membership === null) {
    return yield* new MembershipNotFound({
      userId: cmd.targetUserId,
      organizationId: cmd.organizationId,
    });
  }
  const { events } = MembershipRootOps.revoke(membership);
  yield* repo.deleteOne(cmd.targetUserId, cmd.organizationId);
  yield* bus.dispatch(events);
}, withUnitOfWork);
