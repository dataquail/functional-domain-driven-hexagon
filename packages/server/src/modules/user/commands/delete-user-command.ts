import { type UserNotFound } from "@/modules/user/domain/user-errors.js";
import { type UserRepository } from "@/modules/user/domain/user-repository.js";
import { type DomainEventBus } from "@/platform/domain-event-bus.js";
import { UserId } from "@/platform/ids/user-id.js";
import { type SpanAttributesExtractor } from "@/platform/span-attributable.js";
import { type TransactionRunner } from "@/platform/transaction-runner.js";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const DeleteUserCommand = Schema.TaggedStruct("DeleteUserCommand", {
  userId: UserId,
});
export type DeleteUserCommand = typeof DeleteUserCommand.Type;

export const deleteUserCommandSpanAttributes: SpanAttributesExtractor<DeleteUserCommand> = (
  cmd,
) => ({ "user.id": cmd.userId });

export type DeleteUserOutput = Effect.Effect<
  void,
  UserNotFound,
  UserRepository | DomainEventBus | TransactionRunner
>;

declare module "@/platform/command-bus.js" {
  interface CommandRegistry {
    DeleteUserCommand: {
      readonly command: DeleteUserCommand;
      readonly output: DeleteUserOutput;
    };
  }
}
