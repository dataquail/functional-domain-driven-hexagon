import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type UserNotFound } from "@/modules/user/domain/user-errors.js";
import { type UserRepository } from "@/modules/user/domain/user-repository.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

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
  UserNotFound | PersistenceUnavailable,
  UserRepository | DomainEventBus | UnitOfWork
>;

declare module "@/platform/ddd/command-bus.js" {
  interface CommandRegistry {
    ChangeUserRoleCommand: {
      readonly command: ChangeUserRoleCommand;
      readonly output: ChangeUserRoleOutput;
    };
  }
}
