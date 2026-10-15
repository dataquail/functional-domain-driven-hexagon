import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { DomainEventBus } from "@/globals/application/ports/event-bus";
import { type CreateUserPayload } from "@/modules/user/commands/create-user.command";
import { UserRepository } from "@/modules/user/domain/user/user.repository";
import { UserRootOps } from "@/modules/user/domain/user/user.root-ops";
import { AddressValueObject } from "@/modules/user/domain/user/value-objects/address.value-object";

export const createUserHandler = Effect.fn("createUserHandler")(function* (cmd: CreateUserPayload) {
  const repo = yield* UserRepository;
  const bus = yield* DomainEventBus;
  const crypto = yield* Crypto.Crypto;
  const id = UserId.make(yield* Effect.orDie(crypto.randomUUIDv4));
  yield* Effect.annotateCurrentSpan("user.id", id);
  const now = yield* DateTime.now;

  // Build an address only when the full set is supplied; JIT provisioning
  // passes none, leaving the user address-less until they fill it in.
  const address = Option.all({
    country: Option.fromUndefinedOr(cmd.country),
    street: Option.fromUndefinedOr(cmd.street),
    postalCode: Option.fromUndefinedOr(cmd.postalCode),
  }).pipe(Option.map((fields) => new AddressValueObject(fields)));

  const { events, user } = UserRootOps.create({ id, email: cmd.email, address, now });
  yield* repo.insertOne(user);
  yield* bus.dispatch(events);

  return user.id;
}, withUnitOfWork);
