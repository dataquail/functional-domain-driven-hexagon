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
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

export const createUser = (cmd: CreateUserCommand): CreateUserOutput =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const bus = yield* DomainEventBus;
    const id = UserId.make(yield* Effect.sync(() => crypto.randomUUID()));
    yield* Effect.annotateCurrentSpan("user.id", id);
    const now = yield* DateTime.now;
    // Build an address only when the full set is supplied; JIT provisioning
    // passes none, leaving the user address-less until they fill it in.
    const address =
      cmd.country !== undefined && cmd.street !== undefined && cmd.postalCode !== undefined
        ? new Address({
            country: cmd.country,
            street: cmd.street,
            postalCode: cmd.postalCode,
          })
        : null;
    const { events, user } = User.create({ id, email: cmd.email, address, now });
    yield* repo.insert(user);
    yield* bus.dispatch(events);
    return user.id;
  }).pipe(withUnitOfWork);
