import * as Effect from "effect/Effect";

import {
  type DeleteUserCommand,
  type DeleteUserOutput,
} from "@/modules/user/commands/delete-user-command.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import * as User from "@/modules/user/domain/user.aggregate.js";
import { DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

export const deleteUser = (cmd: DeleteUserCommand): DeleteUserOutput =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;
    const user = yield* repo.findById(cmd.userId);
    const { events } = User.markDeleted(user);
    yield* uow
      .run(
        Effect.gen(function* () {
          yield* repo.remove(user.id);
          yield* bus.dispatch(events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
  });
