import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type SoftDeleteOrganizationCommand,
  type SoftDeleteOrganizationOutput,
} from "@/modules/organization/commands/soft-delete-organization-command.js";
import * as Organization from "@/modules/organization/domain/organization.aggregate.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization-repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

export const softDeleteOrganization = (
  cmd: SoftDeleteOrganizationCommand,
): SoftDeleteOrganizationOutput =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;
    const now = yield* DateTime.now;
    // `findById` filters out tombstoned rows; if the org is already
    // soft-deleted the use case returns the same `OrganizationNotFound`
    // a missing org would — same outward contract, simpler invariant
    // surface. The aggregate's `OrganizationAlreadyDeleted` covers the
    // race where two concurrent soft-deletes both observe the row as
    // active and then race the update.
    const organization = yield* repo.findById(cmd.organizationId);
    const result = yield* Organization.softDelete(organization, { now });
    yield* uow
      .run(
        Effect.gen(function* () {
          yield* repo.update(result.organization);
          yield* bus.dispatch(result.events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
  });
