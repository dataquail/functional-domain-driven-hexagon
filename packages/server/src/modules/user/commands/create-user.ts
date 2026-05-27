import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type CreateUserCommand,
  type CreateUserOutput,
} from "@/modules/user/commands/create-user-command.js";
import { UserRepository } from "@/modules/user/domain/ports/repositories/user-repository.js";
import * as User from "@/modules/user/domain/user.aggregate.js";
import { Address } from "@/modules/user/domain/value-objects/address.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

export const createUser = (cmd: CreateUserCommand): CreateUserOutput =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;
    const id = UserId.make(yield* Effect.sync(() => crypto.randomUUID()));
    yield* Effect.annotateCurrentSpan("user.id", id);
    const now = yield* DateTime.now;
    const address = new Address({
      country: cmd.country,
      street: cmd.street,
      postalCode: cmd.postalCode,
    });
    const { events, user } = User.create({ id, email: cmd.email, address, now });
    yield* uow
      .run(
        Effect.gen(function* () {
          yield* repo.insert(user);
          yield* bus.dispatch(events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
    return user.id;
  });
