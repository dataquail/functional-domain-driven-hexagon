import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type UserRepository } from "@/modules/user/domain/ports/repositories/user-repository.js";
import { type UserAlreadyExists } from "@/modules/user/domain/user-errors.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { type UserId } from "@/platform/ids/user-id.js";

export const CreateUserCommand = Schema.TaggedStruct("CreateUserCommand", {
  email: Schema.String,
  country: Schema.String,
  street: Schema.String,
  postalCode: Schema.String,
});
export type CreateUserCommand = typeof CreateUserCommand.Type;

// Every input field is PII (email, postal address); none are span-safe.
// The generated user id is annotated from inside the handler instead.
export const createUserCommandSpanAttributes: SpanAttributesExtractor<
  CreateUserCommand
> = () => ({});

// Raw handler effect — `UserRepository` is discharged by the wrap in
// `user-command-handlers.ts`; the bus-registered output type lives there.
export type CreateUserOutput = Effect.Effect<
  UserId,
  UserAlreadyExists | PersistenceUnavailable,
  UserRepository | DomainEventBus | UnitOfWork
>;
