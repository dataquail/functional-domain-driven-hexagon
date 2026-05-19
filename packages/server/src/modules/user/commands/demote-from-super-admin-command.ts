import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type UserNotFound } from "@/modules/user/domain/user-errors.js";
import { type UserRepository } from "@/modules/user/domain/user-repository.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

export const DemoteFromSuperAdminCommand = Schema.TaggedStruct("DemoteFromSuperAdminCommand", {
  userId: UserId,
});
export type DemoteFromSuperAdminCommand = typeof DemoteFromSuperAdminCommand.Type;

export const demoteFromSuperAdminCommandSpanAttributes: SpanAttributesExtractor<
  DemoteFromSuperAdminCommand
> = (cmd) => ({ "user.id": cmd.userId });

export type DemoteFromSuperAdminOutput = Effect.Effect<
  void,
  UserNotFound | PersistenceUnavailable,
  UserRepository | DomainEventBus | UnitOfWork
>;

declare module "@/platform/ddd/command-bus.js" {
  interface CommandRegistry {
    DemoteFromSuperAdminCommand: {
      readonly command: DemoteFromSuperAdminCommand;
      readonly output: DemoteFromSuperAdminOutput;
    };
  }
}
