import { type UserAlreadyExists } from "@/modules/user/domain/user-errors.js";
import { UserId } from "@/modules/user/domain/user-id.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import * as User from "@/modules/user/domain/user.js";
import { Address } from "@/modules/user/domain/value-objects/address.js";
import { DomainEventBus } from "@/platform/domain-event-bus.js";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const CreateUserCommand = Schema.TaggedStruct("CreateUserCommand", {
  email: Schema.String,
  country: Schema.String,
  street: Schema.String,
  postalCode: Schema.String,
});
export type CreateUserCommand = typeof CreateUserCommand.Type;

declare module "@/platform/command-bus.js" {
  interface CommandRegistry {
    CreateUserCommand: {
      readonly command: CreateUserCommand;
      readonly output: Effect.Effect<UserId, UserAlreadyExists, UserRepository | DomainEventBus>;
    };
  }
}

export const createUser = (
  cmd: CreateUserCommand,
): Effect.Effect<UserId, UserAlreadyExists, UserRepository | DomainEventBus> =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    const id = UserId.make(yield* Effect.sync(() => crypto.randomUUID()));
    const now = yield* DateTime.now;
    const address = new Address({
      country: cmd.country,
      street: cmd.street,
      postalCode: cmd.postalCode,
    });
    const { events, user } = User.create({ id, email: cmd.email, address, now });
    yield* repo.insert(user);
    yield* bus.publishAll(events);
    return user.id;
  }).pipe(Effect.withSpan("createUser"));
