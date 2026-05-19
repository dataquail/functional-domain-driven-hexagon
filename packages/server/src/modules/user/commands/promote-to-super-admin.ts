import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type PromoteToSuperAdminCommand,
  type PromoteToSuperAdminOutput,
} from "@/modules/user/commands/promote-to-super-admin-command.js";
import * as User from "@/modules/user/domain/user.aggregate.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import { DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

export const promoteToSuperAdmin = (cmd: PromoteToSuperAdminCommand): PromoteToSuperAdminOutput =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;
    const now = yield* DateTime.now;
    const user = yield* repo.findById(cmd.userId);
    const { events, user: updated } = User.promoteToSuperAdmin(user, { now });
    yield* uow
      .run(
        Effect.gen(function* () {
          yield* repo.update(updated);
          yield* bus.dispatch(events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
  });
