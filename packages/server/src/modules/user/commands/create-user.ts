import {
  type CreateUserCommand,
  type CreateUserOutput,
} from "@/modules/user/commands/create-user-command.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import * as User from "@/modules/user/domain/user.aggregate.js";
import { Address } from "@/modules/user/domain/value-objects/address.js";
import { DomainEventBus } from "@/platform/domain-event-bus.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TransactionRunner } from "@/platform/transaction-runner.js";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

export const createUser = (cmd: CreateUserCommand): CreateUserOutput =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    const tx = yield* TransactionRunner;
    const id = UserId.make(yield* Effect.sync(() => crypto.randomUUID()));
    yield* Effect.annotateCurrentSpan("user.id", id);
    const now = yield* DateTime.now;
    const address = new Address({
      country: cmd.country,
      street: cmd.street,
      postalCode: cmd.postalCode,
    });
    const { events, user } = User.create({ id, email: cmd.email, address, now });
    yield* tx
      .run(
        Effect.gen(function* () {
          yield* repo.insert(user);
          yield* bus.dispatch(events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
    return user.id;
  });
