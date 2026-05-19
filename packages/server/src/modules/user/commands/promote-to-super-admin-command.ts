import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type UserNotFound } from "@/modules/user/domain/user-errors.js";
import { type UserRepository } from "@/modules/user/domain/user-repository.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

export const PromoteToSuperAdminCommand = Schema.TaggedStruct("PromoteToSuperAdminCommand", {
  userId: UserId,
});
export type PromoteToSuperAdminCommand = typeof PromoteToSuperAdminCommand.Type;

export const promoteToSuperAdminCommandSpanAttributes: SpanAttributesExtractor<
  PromoteToSuperAdminCommand
> = (cmd) => ({ "user.id": cmd.userId });

export type PromoteToSuperAdminOutput = Effect.Effect<
  void,
  UserNotFound | PersistenceUnavailable,
  UserRepository | DomainEventBus | UnitOfWork
>;

declare module "@/platform/ddd/command-bus.js" {
  interface CommandRegistry {
    PromoteToSuperAdminCommand: {
      readonly command: PromoteToSuperAdminCommand;
      readonly output: PromoteToSuperAdminOutput;
    };
  }
}
