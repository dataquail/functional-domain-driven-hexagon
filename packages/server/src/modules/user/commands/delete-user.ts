import * as Effect from "effect/Effect";

import {
  type DeleteUserCommand,
  type DeleteUserOutput,
} from "@/modules/user/commands/delete-user-command.js";
import { UserRepository } from "@/modules/user/domain/ports/repositories/user-repository.js";
import * as User from "@/modules/user/domain/user.aggregate.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

export const deleteUser = (cmd: DeleteUserCommand): DeleteUserOutput =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    const user = yield* repo.findOneById(cmd.userId);
    const { events } = User.markDeleted(user);
    yield* repo.deleteOne(user.id);
    yield* bus.dispatch(events);
  }).pipe(withUnitOfWork);
