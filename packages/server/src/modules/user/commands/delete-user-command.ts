import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type UserNotFound } from "@/modules/user/domain/user-errors.js";
import { type UserRepository } from "@/modules/user/domain/user-repository.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

export const DeleteUserCommand = Schema.TaggedStruct("DeleteUserCommand", {
  userId: UserId,
});
export type DeleteUserCommand = typeof DeleteUserCommand.Type;

export const deleteUserCommandSpanAttributes: SpanAttributesExtractor<DeleteUserCommand> = (
  cmd,
) => ({ "user.id": cmd.userId });

// Raw handler effect — `UserRepository` is discharged by the wrap in
// `user-command-handlers.ts`; the bus-registered output type lives there.
export type DeleteUserOutput = Effect.Effect<
  void,
  UserNotFound | PersistenceUnavailable,
  UserRepository | DomainEventBus | UnitOfWork
>;
