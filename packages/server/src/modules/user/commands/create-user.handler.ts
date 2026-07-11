import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type CreateUserCommand } from "@/modules/user/commands/create-user.command.js";
import { UserRepository } from "@/modules/user/domain/user/user.repository.js";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops.js";
import { AddressValueObject } from "@/modules/user/domain/user/value-objects/address.value-object.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

export const createUser = Effect.fn("createUser")(function* (cmd: CreateUserCommand) {
  const repo = yield* UserRepository;
  const bus = yield* DomainEventBus;
  const id = UserId.make(yield* Effect.sync(() => crypto.randomUUID()));
  yield* Effect.annotateCurrentSpan("user.id", id);
  const now = yield* DateTime.now;
  // Build an address only when the full set is supplied; JIT provisioning
  // passes none, leaving the user address-less until they fill it in.
  const address =
    cmd.country !== undefined && cmd.street !== undefined && cmd.postalCode !== undefined
      ? new AddressValueObject({
          country: cmd.country,
          street: cmd.street,
          postalCode: cmd.postalCode,
        })
      : null;
  const { events, user } = UserRootOps.create({ id, email: cmd.email, address, now });
  yield* repo.insertOne(user);
  yield* bus.dispatch(events);
  return user.id;
}, withUnitOfWork);
