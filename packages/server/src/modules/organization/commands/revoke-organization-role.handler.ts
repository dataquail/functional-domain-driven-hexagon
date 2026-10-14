import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { Spec } from "@/globals/application/ddd/specification.ts";
import { DomainEventBus } from "@/globals/application/ports/event-bus.ts";
import { type RevokeOrganizationRolePayload } from "@/modules/organization/commands/revoke-organization-role.command.ts";
import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.ts";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles/organization-roles.root-ops.ts";
import { OrganizationRolesSpecifications } from "@/modules/organization/domain/organization-roles/organization-roles.specification.ts";

export const revokeOrganizationRoleHandler = Effect.fn("revokeOrganizationRoleHandler")(function* (
  cmd: RevokeOrganizationRolePayload,
) {
  const repo = yield* OrganizationRolesRepository;
  const bus = yield* DomainEventBus;

  const existing = yield* repo.findOne(
    Spec.and(
      OrganizationRolesSpecifications.forUser(cmd.userId),
      OrganizationRolesSpecifications.forOrganization(cmd.organizationId),
    ),
  );

  const aggregate = Option.getOrElse(existing, () =>
    OrganizationRolesRootOps.empty(cmd.userId, cmd.organizationId),
  );

  const result = yield* Effect.fromResult(OrganizationRolesRootOps.revokeRole(aggregate, cmd.role));

  yield* repo.upsertOne(result.organizationRoles);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
