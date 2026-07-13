import * as Effect from "effect/Effect";

import { type RevokeOrganizationRoleCommand } from "@/modules/organization/commands/revoke-organization-role.command.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.js";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles/organization-roles.root-ops.js";
import { OrganizationRolesSpecifications } from "@/modules/organization/domain/organization-roles/organization-roles.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const revokeOrganizationRole = Effect.fn("revokeOrganizationRole")(function* (
  cmd: RevokeOrganizationRoleCommand,
) {
  const repo = yield* OrganizationRolesRepository;
  const bus = yield* DomainEventBus;

  const aggregate =
    (yield* repo.findOne(
      Spec.and(
        OrganizationRolesSpecifications.forUser(cmd.userId),
        OrganizationRolesSpecifications.forOrganization(cmd.organizationId),
      ),
    )) ?? OrganizationRolesRootOps.empty(cmd.userId, cmd.organizationId);
  const result = yield* Effect.fromResult(OrganizationRolesRootOps.revokeRole(aggregate, cmd.role));

  yield* repo.upsertOne(result.organizationRoles);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
