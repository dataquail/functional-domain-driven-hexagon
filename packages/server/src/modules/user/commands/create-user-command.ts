import { type UserAlreadyExists } from "@/modules/user/domain/user-errors.js";
import { type UserId } from "@/modules/user/domain/user-id.js";
import { type UserRepository } from "@/modules/user/domain/user-repository.js";
import { type DomainEventBus } from "@/platform/domain-event-bus.js";
import { type SpanAttributesExtractor } from "@/platform/span-attributable.js";
import { type TransactionRunner } from "@/platform/transaction-runner.js";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

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

export type CreateUserOutput = Effect.Effect<
  UserId,
  UserAlreadyExists,
  UserRepository | DomainEventBus | TransactionRunner
>;

declare module "@/platform/command-bus.js" {
  interface CommandRegistry {
    CreateUserCommand: {
      readonly command: CreateUserCommand;
      readonly output: CreateUserOutput;
    };
  }
}
