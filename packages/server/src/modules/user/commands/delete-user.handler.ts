import * as Effect from "effect/Effect";

import { type DeleteUserCommand } from "@/modules/user/commands/delete-user.command.js";
import { UserNotFound } from "@/modules/user/domain/user/user.errors.js";
import { UserRepository } from "@/modules/user/domain/user/user.repository.js";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops.js";
import { UserSpecifications } from "@/modules/user/domain/user/user.specification.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const deleteUser = Effect.fn("deleteUser")(function* (cmd: DeleteUserCommand) {
  const repo = yield* UserRepository;
  const bus = yield* DomainEventBus;
  const user = yield* repo.findOne(UserSpecifications.withId(cmd.userId));
  if (user === null) {
    return yield* new UserNotFound({ userId: cmd.userId });
  }
  const { events } = UserRootOps.markDeleted(user);
  yield* repo.deleteOne(user.id);
  yield* bus.dispatch(events);
}, withUnitOfWork);
