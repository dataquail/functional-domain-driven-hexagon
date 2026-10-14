import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { DomainEventBus } from "@/globals/application/ports/event-bus.ts";
import { type DeleteUserPayload } from "@/modules/user/commands/delete-user.command.ts";
import { UserNotFound } from "@/modules/user/domain/user/user.errors.ts";
import { UserRepository } from "@/modules/user/domain/user/user.repository.ts";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops.ts";
import { UserSpecifications } from "@/modules/user/domain/user/user.specification.ts";

export const deleteUserHandler = Effect.fn("deleteUserHandler")(function* (cmd: DeleteUserPayload) {
  const repo = yield* UserRepository;
  const bus = yield* DomainEventBus;
  const found = yield* repo.findOne(UserSpecifications.withId(cmd.userId));

  if (Option.isNone(found)) {
    return yield* new UserNotFound({ userId: cmd.userId });
  }

  const user = found.value;

  const { events } = UserRootOps.markDeleted(user);
  yield* repo.deleteOne(user.id);
  yield* bus.dispatch(events);
}, withUnitOfWork);
