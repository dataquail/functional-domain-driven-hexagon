import {
  type ChangeUserRoleCommand,
  type ChangeUserRoleOutput,
} from "@/modules/user/application/commands/change-user-role-command.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import * as User from "@/modules/user/domain/user.js";
import { DomainEventBus } from "@/platform/domain-event-bus.js";
import { TransactionRunner } from "@/platform/transaction-runner.js";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

export const changeUserRole = (cmd: ChangeUserRoleCommand): ChangeUserRoleOutput =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    const tx = yield* TransactionRunner;
    const now = yield* DateTime.now;
    const user = yield* repo.findById(cmd.userId);
    const { events, user: updated } =
      cmd.role === "admin" ? User.makeAdmin(user, { now }) : User.makeModerator(user, { now });
    yield* tx
      .run(
        Effect.gen(function* () {
          yield* repo.update(updated);
          yield* bus.dispatch(events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
  });
