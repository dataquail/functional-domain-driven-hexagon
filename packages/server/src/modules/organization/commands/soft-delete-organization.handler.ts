import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type SoftDeleteOrganizationCommand } from "@/modules/organization/commands/soft-delete-organization.command.js";
import { OrganizationRootOps } from "@/modules/organization/domain/organization.root.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization.repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const softDeleteOrganization = Effect.fn("softDeleteOrganization")(function* (
  cmd: SoftDeleteOrganizationCommand,
) {
  const repo = yield* OrganizationRepository;
  const bus = yield* DomainEventBus;
  const now = yield* DateTime.now;
  // `findOneById` filters out tombstoned rows; if the org is already
  // soft-deleted the use case returns the same `OrganizationNotFound`
  // a missing org would — same outward contract, simpler invariant
  // surface. The aggregate's `OrganizationAlreadyDeleted` covers the
  // race where two concurrent soft-deletes both observe the row as
  // active and then race the update.
  const organization = yield* repo.findOneById(cmd.organizationId);
  const result = yield* Effect.fromResult(OrganizationRootOps.softDelete(organization, { now }));
  yield* repo.updateOne(result.organization);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
