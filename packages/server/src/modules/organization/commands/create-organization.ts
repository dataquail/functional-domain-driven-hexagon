import * as crypto from "node:crypto";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type CreateOrganizationCommand,
  type CreateOrganizationOutput,
} from "@/modules/organization/commands/create-organization-command.js";
import * as Membership from "@/modules/organization/domain/membership.aggregate.js";
import { MembershipRepository } from "@/modules/organization/domain/membership-repository.js";
import * as Organization from "@/modules/organization/domain/organization.aggregate.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization-repository.js";
import { DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

// Creating an org also creates the creator's Membership in the same
// unit of work — orgs without their first member are degenerate, and
// the only path to first-membership for any non-creator is an
// Invitation (which requires an existing org). Both aggregates'
// events are dispatched together so Phase 4's default-bundle handler
// can subscribe to MembershipCreated for the creator's grants in the
// same transaction.
export const createOrganization = (cmd: CreateOrganizationCommand): CreateOrganizationOutput =>
  Effect.gen(function* () {
    const orgRepo = yield* OrganizationRepository;
    const memberRepo = yield* MembershipRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;
    const now = yield* DateTime.now;
    const id = OrganizationId.make(crypto.randomUUID());
    const { events: orgEvents, organization } = Organization.create({ id, name: cmd.name, now });
    const { events: memberEvents, membership } = Membership.create({
      userId: cmd.actorUserId,
      organizationId: id,
      now,
    });
    yield* uow
      .run(
        Effect.gen(function* () {
          yield* orgRepo.insert(organization);
          yield* memberRepo.insert(membership);
          yield* bus.dispatch([...orgEvents, ...memberEvents]);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
    return id;
  });
