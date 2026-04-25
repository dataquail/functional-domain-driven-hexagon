import { type UserNotFound } from "@/modules/user/domain/user-errors.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import * as User from "@/modules/user/domain/user.js";
import { DomainEventBus } from "@/platform/domain-event-bus.js";
import { UserId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const DeleteUserCommand = Schema.TaggedStruct("DeleteUserCommand", {
  userId: UserId,
});
export type DeleteUserCommand = typeof DeleteUserCommand.Type;

declare module "@/platform/command-bus.js" {
  interface CommandRegistry {
    DeleteUserCommand: {
      readonly command: DeleteUserCommand;
      readonly output: Effect.Effect<void, UserNotFound, UserRepository | DomainEventBus>;
    };
  }
}

export const deleteUser = (
  cmd: DeleteUserCommand,
): Effect.Effect<void, UserNotFound, UserRepository | DomainEventBus> =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    const user = yield* repo.findById(cmd.userId);
    const { events } = User.markDeleted(user);
    yield* repo.remove(user.id);
    yield* bus.publishAll(events);
  }).pipe(Effect.withSpan("deleteUser"));
