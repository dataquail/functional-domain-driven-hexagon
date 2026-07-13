import * as Effect from "effect/Effect";

import { type LeaveOrganizationCommand } from "@/modules/organization/commands/leave-organization.command.js";
import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.js";
import { MembershipRootOps } from "@/modules/organization/domain/membership/membership.root-ops.js";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const leaveOrganization = Effect.fn("leaveOrganization")(function* (
  cmd: LeaveOrganizationCommand,
) {
  const repo = yield* MembershipRepository;
  const bus = yield* DomainEventBus;
  const membership = yield* repo.findOne(
    Spec.and(
      MembershipSpecifications.forUser(cmd.userId),
      MembershipSpecifications.forOrganization(cmd.organizationId),
    ),
  );
  if (membership === null) {
    return yield* new MembershipNotFound({
      userId: cmd.userId,
      organizationId: cmd.organizationId,
    });
  }
  const { events } = MembershipRootOps.revoke(membership);
  yield* repo.deleteOne(cmd.userId, cmd.organizationId);
  yield* bus.dispatch(events);
}, withUnitOfWork);
