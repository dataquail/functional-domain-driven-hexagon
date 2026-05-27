import * as Effect from "effect/Effect";

import {
  type RevokeOrganizationRoleCommand,
  type RevokeOrganizationRoleOutput,
} from "@/modules/organization/commands/revoke-organization-role-command.js";
import * as OrganizationRoles from "@/modules/organization/domain/organization-roles.aggregate.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles-repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

export const revokeOrganizationRole = (
  cmd: RevokeOrganizationRoleCommand,
): RevokeOrganizationRoleOutput =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRolesRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;

    const aggregate = yield* repo.findByUserIdAndOrgId(cmd.userId, cmd.organizationId);
    const result = yield* OrganizationRoles.revokeRole(aggregate, cmd.role);

    yield* uow
      .run(
        Effect.gen(function* () {
          yield* repo.save(result.organizationRoles);
          yield* bus.dispatch(result.events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
  });
