import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Effect from "effect/Effect";

import { Spec } from "@/globals/application/ddd/specification.js";
import { DomainEventBus } from "@/globals/application/ports/event-bus.js";
import { type RevokeOrganizationRolePayload } from "@/modules/organization/commands/revoke-organization-role.command.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.js";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles/organization-roles.root-ops.js";
import { OrganizationRolesSpecifications } from "@/modules/organization/domain/organization-roles/organization-roles.specification.js";

export const revokeOrganizationRoleHandler = Effect.fn("revokeOrganizationRoleHandler")(function* (
  cmd: RevokeOrganizationRolePayload,
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
