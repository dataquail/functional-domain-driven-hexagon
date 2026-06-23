import * as Effect from "effect/Effect";

import {
  type RevokeRoleCommand,
  type RevokeRoleOutput,
} from "@/modules/role/commands/revoke-role-command.js";
import { RolesRepository } from "@/modules/role/domain/ports/repositories/roles-repository.js";
import * as Roles from "@/modules/role/domain/roles.aggregate.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const revokeRole = (cmd: RevokeRoleCommand): RevokeRoleOutput =>
  Effect.gen(function* () {
    const repo = yield* RolesRepository;
    const bus = yield* DomainEventBus;

    const aggregate = yield* repo.findByUserId(cmd.userId);
    const result = yield* Roles.revoke(aggregate, cmd.role);

    yield* repo.save(result.roles);
    yield* bus.dispatch(result.events);
  }).pipe(withUnitOfWork);
