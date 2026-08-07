import { withUnitOfWork } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { type RevokeRolePayload } from "@/modules/role/commands/revoke-role.command.js";
import { RolesRepository } from "@/modules/role/domain/roles/roles.repository.js";
import { RolesRootOps } from "@/modules/role/domain/roles/roles.root-ops.js";
import { RolesSpecifications } from "@/modules/role/domain/roles/roles.specification.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";

export const revokeRoleHandler = Effect.fn("revokeRoleHandler")(function* (cmd: RevokeRolePayload) {
  const repo = yield* RolesRepository;
  const bus = yield* DomainEventBus;

  const aggregate =
    (yield* repo.findOne(RolesSpecifications.forUser(cmd.userId))) ??
    RolesRootOps.empty(cmd.userId);
  const result = yield* Effect.fromResult(RolesRootOps.revoke(aggregate, cmd.role));

  yield* repo.upsertOne(result.roles);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
