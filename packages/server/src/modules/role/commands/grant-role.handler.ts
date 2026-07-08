import * as Effect from "effect/Effect";

import {
  type GrantRoleCommand,
  type GrantRoleOutput,
} from "@/modules/role/commands/grant-role.command.js";
import { RolesRepository } from "@/modules/role/domain/ports/repositories/roles.repository.js";
import { CannotPromoteSelf } from "@/modules/role/domain/role.errors.js";
import { RolesRootOps } from "@/modules/role/domain/roles.root.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const grantRole = (cmd: GrantRoleCommand): GrantRoleOutput =>
  Effect.gen(function* () {
    // Command-level invariant: a user can't grant themselves a role.
    // Prevents self-elevation regardless of the policy layer's
    // decision about `user.update`.
    if (cmd.actorUserId === cmd.userId) {
      return yield* Effect.fail(new CannotPromoteSelf({ userId: cmd.userId }));
    }

    const repo = yield* RolesRepository;
    const bus = yield* DomainEventBus;

    const aggregate = yield* repo.findOneByUserId(cmd.userId);
    const result = yield* Effect.fromResult(RolesRootOps.grant(aggregate, cmd.role));

    yield* repo.upsertOne(result.roles);
    yield* bus.dispatch(result.events);
  }).pipe(withUnitOfWork);
