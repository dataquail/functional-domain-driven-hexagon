import * as Effect from "effect/Effect";

import { type RevokeRoleCommand } from "@/modules/role/commands/revoke-role.command.js";
import { RolesRepository } from "@/modules/role/domain/ports/repositories/roles.repository.js";
import { RolesRootOps } from "@/modules/role/domain/roles.root-ops.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const revokeRole = Effect.fn("revokeRole")(function* (cmd: RevokeRoleCommand) {
  const repo = yield* RolesRepository;
  const bus = yield* DomainEventBus;

  const aggregate = yield* repo.findOneByUserId(cmd.userId);
  const result = yield* Effect.fromResult(RolesRootOps.revoke(aggregate, cmd.role));

  yield* repo.upsertOne(result.roles);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
