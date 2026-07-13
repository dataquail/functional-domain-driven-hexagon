import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type SoftDeleteOrganizationCommand } from "@/modules/organization/commands/soft-delete-organization.command.js";
import { OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.js";
import { OrganizationRootOps } from "@/modules/organization/domain/organization/organization.root-ops.js";
import { OrganizationSpecifications } from "@/modules/organization/domain/organization/organization.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const softDeleteOrganization = Effect.fn("softDeleteOrganization")(function* (
  cmd: SoftDeleteOrganizationCommand,
) {
  const repo = yield* OrganizationRepository;
  const bus = yield* DomainEventBus;
  const now = yield* DateTime.now;
  // The active-only spec hides tombstoned rows; if the org is already
  // soft-deleted the use case returns the same `OrganizationNotFound`
  // a missing org would — same outward contract, simpler invariant
  // surface. The aggregate's `OrganizationAlreadyDeleted` covers the
  // race where two concurrent soft-deletes both observe the row as
  // active and then race the update.
  const organization = yield* repo.findOne(
    Spec.and(
      OrganizationSpecifications.withId(cmd.organizationId),
      OrganizationSpecifications.notDeleted,
    ),
  );
  if (organization === null) {
    return yield* new OrganizationNotFound({ organizationId: cmd.organizationId });
  }
  const result = yield* Effect.fromResult(OrganizationRootOps.softDelete(organization, { now }));
  yield* repo.updateOne(result.organization);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
