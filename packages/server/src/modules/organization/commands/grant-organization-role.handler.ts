import * as Effect from "effect/Effect";

import { type GrantOrganizationRoleCommand } from "@/modules/organization/commands/grant-organization-role.command.js";
import { CannotPromoteSelfInOrganization } from "@/modules/organization/domain/organization-role.errors.js";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles.root.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles.repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const grantOrganizationRole = Effect.fn("grantOrganizationRole")(function* (
  cmd: GrantOrganizationRoleCommand,
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

  const aggregate = yield* repo.findOneByUserIdAndOrgId(cmd.userId, cmd.organizationId);
  const result = yield* Effect.fromResult(
    OrganizationRolesRootOps.grantRole(aggregate, cmd.role, cmd.actorUserId),
  );

  yield* repo.upsertOne(result.organizationRoles);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
