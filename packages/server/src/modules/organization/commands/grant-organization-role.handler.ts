import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { Spec } from "@/globals/application/ddd/specification";
import { DomainEventBus } from "@/globals/application/ports/event-bus";
import { type GrantOrganizationRolePayload } from "@/modules/organization/commands/grant-organization-role.command";
import { CannotPromoteSelfInOrganization } from "@/modules/organization/domain/organization-roles/organization-role.errors";
import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles/organization-roles.root-ops";
import { OrganizationRolesSpecifications } from "@/modules/organization/domain/organization-roles/organization-roles.specification";

export const grantOrganizationRoleHandler = Effect.fn("grantOrganizationRoleHandler")(function* (
  cmd: GrantOrganizationRolePayload,
) {
  // Command-level invariant: a user can't grant themselves an org role.
  // Mirrors `CannotPromoteSelf` in the role module — prevents
  // self-elevation regardless of the policy layer's decision.
  if (cmd.actorUserId === cmd.userId) {
    return yield* new CannotPromoteSelfInOrganization({
      userId: cmd.userId,
      organizationId: cmd.organizationId,
    });
  }

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

  const result = yield* Effect.fromResult(
    OrganizationRolesRootOps.grantRole(aggregate, cmd.role, cmd.actorUserId),
  );

  yield* repo.upsertOne(result.organizationRoles);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
