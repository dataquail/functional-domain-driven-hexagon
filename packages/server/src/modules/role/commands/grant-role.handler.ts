import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { DomainEventBus } from "@/globals/application/ports/event-bus.ts";
import { type GrantRolePayload } from "@/modules/role/commands/grant-role.command.ts";
import { CannotPromoteSelf } from "@/modules/role/domain/roles/role.errors.ts";
import { RolesRepository } from "@/modules/role/domain/roles/roles.repository.ts";
import { RolesRootOps } from "@/modules/role/domain/roles/roles.root-ops.ts";
import { RolesSpecifications } from "@/modules/role/domain/roles/roles.specification.ts";

export const grantRoleHandler = Effect.fn("grantRoleHandler")(function* (cmd: GrantRolePayload) {
  // Command-level invariant: a user can't grant themselves a role.
  // Prevents self-elevation regardless of the policy layer's
  // decision about `user.update`.
  if (cmd.actorUserId === cmd.userId) {
    return yield* new CannotPromoteSelf({ userId: cmd.userId });
  }

  const repo = yield* RolesRepository;
  const bus = yield* DomainEventBus;

  const aggregate = Option.getOrElse(
    yield* repo.findOne(RolesSpecifications.forUser(cmd.userId)),
    () => RolesRootOps.empty(cmd.userId),
  );

  const result = yield* Effect.fromResult(RolesRootOps.grant(aggregate, cmd.role));

  yield* repo.upsertOne(result.roles);
  yield* bus.dispatch(result.events);
}, withUnitOfWork);
