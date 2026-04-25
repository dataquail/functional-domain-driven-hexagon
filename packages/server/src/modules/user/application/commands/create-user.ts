import { type UserAlreadyExists } from "@/modules/user/domain/user-errors.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import * as User from "@/modules/user/domain/user.js";
import { Address } from "@/modules/user/domain/value-objects/address.js";
import { DomainEventBus } from "@/platform/domain-event-bus.js";
import { UserId } from "@org/contracts/EntityIds";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const CreateUserCommand = Schema.TaggedStruct("CreateUserCommand", {
  email: Schema.String,
  address: Address,
});
export type CreateUserCommand = typeof CreateUserCommand.Type;

export const createUser = (
  cmd: CreateUserCommand,
): Effect.Effect<UserId, UserAlreadyExists, UserRepository | DomainEventBus> =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    const id = UserId.make(yield* Effect.sync(() => crypto.randomUUID()));
    const now = yield* DateTime.now;
    const { events, user } = User.create({ id, email: cmd.email, address: cmd.address, now });
    yield* repo.insert(user);
    yield* bus.publishAll(events);
    return user.id;
  }).pipe(Effect.withSpan("createUser"));
