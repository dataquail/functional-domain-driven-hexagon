import * as Effect from "effect/Effect";

import { type GrantRoleCommand } from "@/modules/role/commands/grant-role.command.js";
import { CannotPromoteSelf } from "@/modules/role/domain/roles/role.errors.js";
import { RolesRepository } from "@/modules/role/domain/roles/roles.repository.js";
import { RolesRootOps } from "@/modules/role/domain/roles/roles.root-ops.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const grantRole = Effect.fn("grantRole")(function* (cmd: GrantRoleCommand) {
  // Command-level invariant: a user can't grant themselves a role.
  // Prevents self-elevation regardless of the policy layer's
  // decision about `user.update`.
  if (cmd.actorUserId === cmd.userId) {
    return yield* new CannotPromoteSelf({ userId: cmd.userId });
  }

  const repo = yield* RolesRepository;
  const bus = yield* DomainEventBus;

  const aggregate = yield* repo.findOneByUserId(cmd.userId);
  const result = yield* Effect.fromResult(RolesRootOps.grant(aggregate, cmd.role));

  yield* repo.upsertOne(result.roles);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
