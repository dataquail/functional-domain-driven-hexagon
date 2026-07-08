import * as Effect from "effect/Effect";

import {
  type RevokeRoleCommand,
  type RevokeRoleOutput,
} from "@/modules/role/commands/revoke-role.command.js";
import { RolesRepository } from "@/modules/role/domain/ports/repositories/roles.repository.js";
import { RolesRootOps } from "@/modules/role/domain/roles.root.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const revokeRole = (cmd: RevokeRoleCommand): RevokeRoleOutput =>
  Effect.gen(function* () {
    const repo = yield* RolesRepository;
    const bus = yield* DomainEventBus;

    const aggregate = yield* repo.findOneByUserId(cmd.userId);
    const result = yield* Effect.fromResult(RolesRootOps.revoke(aggregate, cmd.role));

    yield* repo.upsertOne(result.roles);
    yield* bus.dispatch(result.events);
  }).pipe(withUnitOfWork);
