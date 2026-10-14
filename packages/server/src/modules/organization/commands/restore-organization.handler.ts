import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { DomainEventBus } from "@/globals/application/ports/event-bus.ts";
import { type RestoreOrganizationPayload } from "@/modules/organization/commands/restore-organization.command.ts";
import { OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.ts";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.ts";
import { OrganizationRootOps } from "@/modules/organization/domain/organization/organization.root-ops.ts";
import { OrganizationSpecifications } from "@/modules/organization/domain/organization/organization.specification.ts";

export const restoreOrganizationHandler = Effect.fn("restoreOrganizationHandler")(function* (
  cmd: RestoreOrganizationPayload,
) {
  const repo = yield* OrganizationRepository;
  const bus = yield* DomainEventBus;
  const now = yield* DateTime.now;

  // Restore is the one write path that needs to load the tombstoned
  // row; `withId` alone (no `notDeleted`) keeps it visible.
  const maybeOrganization = yield* repo.findOne(
    OrganizationSpecifications.withId(cmd.organizationId),
  );

  if (Option.isNone(maybeOrganization)) {
    return yield* new OrganizationNotFound({ organizationId: cmd.organizationId });
  }

  const organization = maybeOrganization.value;

  const result = yield* Effect.fromResult(OrganizationRootOps.restore(organization, { now }));
  yield* repo.updateOne(result.organization);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
