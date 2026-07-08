import * as Effect from "effect/Effect";

import { type LeaveOrganizationCommand } from "@/modules/organization/commands/leave-organization.command.js";
import { MembershipRootOps } from "@/modules/organization/domain/membership.root.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership.repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const leaveOrganization = Effect.fn("leaveOrganization")(function* (
  cmd: LeaveOrganizationCommand,
) {
  const repo = yield* MembershipRepository;
  const bus = yield* DomainEventBus;
  const membership = yield* repo.findOneByUserIdAndOrgId(cmd.userId, cmd.organizationId);
  const { events } = MembershipRootOps.revoke(membership);
  yield* repo.deleteOne(cmd.userId, cmd.organizationId);
  yield* bus.dispatch(events);
}, withUnitOfWork);
