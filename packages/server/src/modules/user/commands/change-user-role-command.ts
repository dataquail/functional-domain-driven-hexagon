import { type UserNotFound } from "@/modules/user/domain/user-errors.js";
import { UserId } from "@/modules/user/domain/user-id.js";
import { type UserRepository } from "@/modules/user/domain/user-repository.js";
import { type DomainEventBus } from "@/platform/domain-event-bus.js";
import { type SpanAttributesExtractor } from "@/platform/span-attributable.js";
import { type TransactionRunner } from "@/platform/transaction-runner.js";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const PromotableRole = Schema.Literal("admin", "moderator");
export type PromotableRole = typeof PromotableRole.Type;

export const ChangeUserRoleCommand = Schema.TaggedStruct("ChangeUserRoleCommand", {
  userId: UserId,
  role: PromotableRole,
});
export type ChangeUserRoleCommand = typeof ChangeUserRoleCommand.Type;

export const changeUserRoleCommandSpanAttributes: SpanAttributesExtractor<ChangeUserRoleCommand> = (
  cmd,
) => ({ "user.id": cmd.userId, "user.role.target": cmd.role });

export type ChangeUserRoleOutput = Effect.Effect<
  void,
  UserNotFound,
  UserRepository | DomainEventBus | TransactionRunner
>;

declare module "@/platform/command-bus.js" {
  interface CommandRegistry {
    ChangeUserRoleCommand: {
      readonly command: ChangeUserRoleCommand;
      readonly output: ChangeUserRoleOutput;
    };
  }
}
