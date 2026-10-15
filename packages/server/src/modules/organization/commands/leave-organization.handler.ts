import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { Spec } from "@/globals/application/ddd/specification";
import { DomainEventBus } from "@/globals/application/ports/event-bus";
import { type LeaveOrganizationPayload } from "@/modules/organization/commands/leave-organization.command";
import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository";
import { MembershipRootOps } from "@/modules/organization/domain/membership/membership.root-ops";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification";

export const leaveOrganizationHandler = Effect.fn("leaveOrganizationHandler")(function* (
  cmd: LeaveOrganizationPayload,
) {
  const repo = yield* MembershipRepository;
  const bus = yield* DomainEventBus;

  const maybeMembership = yield* repo.findOne(
    Spec.and(
      MembershipSpecifications.forUser(cmd.userId),
      MembershipSpecifications.forOrganization(cmd.organizationId),
    ),
  );

  if (Option.isNone(maybeMembership)) {
    return yield* new MembershipNotFound({
      userId: cmd.userId,
      organizationId: cmd.organizationId,
    });
  }

  const membership = maybeMembership.value;

  const { events } = MembershipRootOps.revoke(membership);
  yield* repo.deleteOne(cmd.userId, cmd.organizationId);
  yield* bus.dispatch(events);
}, withUnitOfWork);
