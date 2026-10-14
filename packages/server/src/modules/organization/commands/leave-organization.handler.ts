import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { Spec } from "@/globals/application/ddd/specification.ts";
import { DomainEventBus } from "@/globals/application/ports/event-bus.ts";
import { type LeaveOrganizationPayload } from "@/modules/organization/commands/leave-organization.command.ts";
import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.ts";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.ts";
import { MembershipRootOps } from "@/modules/organization/domain/membership/membership.root-ops.ts";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification.ts";

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
