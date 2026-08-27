import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Effect from "effect/Effect";

import { type LeaveOrganizationPayload } from "@/modules/organization/commands/leave-organization.command.js";
import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.js";
import { MembershipRootOps } from "@/modules/organization/domain/membership/membership.root-ops.js";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";

export const leaveOrganizationHandler = Effect.fn("leaveOrganizationHandler")(function* (
  cmd: LeaveOrganizationPayload,
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
