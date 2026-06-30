import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type RestoreOrganizationCommand,
  type RestoreOrganizationOutput,
} from "@/modules/organization/commands/restore-organization-command.js";
import * as Organization from "@/modules/organization/domain/organization.aggregate.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization-repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const restoreOrganization = (cmd: RestoreOrganizationCommand): RestoreOrganizationOutput =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    const bus = yield* DomainEventBus;
    const now = yield* DateTime.now;
    // Restore is the one write path that needs to load the tombstoned
    // row; the default `findOneById` filters it out.
    const organization = yield* repo.findOneByIdIncludingDeleted(cmd.organizationId);
    const result = yield* Organization.restore(organization, { now });
    yield* repo.updateOne(result.organization);
    yield* bus.dispatch(result.events);
  }).pipe(withUnitOfWork);
