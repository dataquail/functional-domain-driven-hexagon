import * as Effect from "effect/Effect";

import {
  type LeaveOrganizationCommand,
  type LeaveOrganizationOutput,
} from "@/modules/organization/commands/leave-organization-command.js";
import * as Membership from "@/modules/organization/domain/membership.aggregate.js";
import { MembershipRepository } from "@/modules/organization/domain/membership-repository.js";
import { DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

export const leaveOrganization = (cmd: LeaveOrganizationCommand): LeaveOrganizationOutput =>
  Effect.gen(function* () {
    const repo = yield* MembershipRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;
    const membership = yield* repo.findByUserIdAndOrgId(cmd.userId, cmd.organizationId);
    const { events } = Membership.revoke(membership);
    yield* uow
      .run(
        Effect.gen(function* () {
          yield* repo.delete(cmd.userId, cmd.organizationId);
          yield* bus.dispatch(events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
  });
