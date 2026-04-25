import { type UserNotFound } from "@/modules/user/domain/user-errors.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import * as User from "@/modules/user/domain/user.js";
import { DomainEventBus } from "@/platform/domain-event-bus.js";
import { UserId } from "@org/contracts/EntityIds";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const PromotableRole = Schema.Literal("admin", "moderator");
export type PromotableRole = typeof PromotableRole.Type;

export const ChangeUserRoleCommand = Schema.TaggedStruct("ChangeUserRoleCommand", {
  userId: UserId,
  role: PromotableRole,
});
export type ChangeUserRoleCommand = typeof ChangeUserRoleCommand.Type;

declare module "@/platform/command-bus.js" {
  interface CommandRegistry {
    ChangeUserRoleCommand: {
      readonly command: ChangeUserRoleCommand;
      readonly output: Effect.Effect<void, UserNotFound, UserRepository | DomainEventBus>;
    };
  }
}

export const changeUserRole = (
  cmd: ChangeUserRoleCommand,
): Effect.Effect<void, UserNotFound, UserRepository | DomainEventBus> =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    const now = yield* DateTime.now;
    const user = yield* repo.findById(cmd.userId);
    const { events, user: updated } =
      cmd.role === "admin" ? User.makeAdmin(user, { now }) : User.makeModerator(user, { now });
    yield* repo.update(updated);
    yield* bus.publishAll(events);
  }).pipe(Effect.withSpan("changeUserRole"));
