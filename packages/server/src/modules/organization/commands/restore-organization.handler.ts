import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type RestoreOrganizationCommand } from "@/modules/organization/commands/restore-organization.command.js";
import { OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.js";
import { OrganizationRootOps } from "@/modules/organization/domain/organization/organization.root-ops.js";
import { OrganizationSpecifications } from "@/modules/organization/domain/organization/organization.specification.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const restoreOrganization = Effect.fn("restoreOrganization")(function* (
  cmd: RestoreOrganizationCommand,
) {
  const repo = yield* OrganizationRepository;
  const bus = yield* DomainEventBus;
  const now = yield* DateTime.now;
  // Restore is the one write path that needs to load the tombstoned
  // row; `withId` alone (no `notDeleted`) keeps it visible.
  const organization = yield* repo.findOne(OrganizationSpecifications.withId(cmd.organizationId));
  if (organization === null) {
    return yield* new OrganizationNotFound({ organizationId: cmd.organizationId });
  }
  const result = yield* Effect.fromResult(OrganizationRootOps.restore(organization, { now }));
  yield* repo.updateOne(result.organization);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
