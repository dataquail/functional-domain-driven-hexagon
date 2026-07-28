import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserNotFound } from "@/modules/user/domain/user/user.errors.js";
import { type UserDeleted } from "@/modules/user/domain/user/user.events.js";
import { UserRepository } from "@/modules/user/domain/user/user.repository.js";
import { UserSpecifications } from "@/modules/user/domain/user/user.specification.js";
import { AddressValueObject } from "@/modules/user/domain/user/value-objects/address.value-object.js";
import { UserRepositoryFake } from "@/modules/user/infrastructure/repositories/user.repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

import { createUserHandler } from "./create-user.handler.js";
import { deleteUserHandler } from "./delete-user.handler.js";

const TestLayer = Layer.mergeAll(UserRepositoryFake, RecordingEventBus, IdentityUnitOfWork);

const address = AddressValueObject.make({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

describe("deleteUserHandler", () => {
  it.effect("removes the user and publishes UserDeleted", () =>
    Effect.gen(function* () {
      const repo = yield* UserRepository;
      const rec = yield* RecordedEvents;
      const id = yield* createUserHandler({
        email: "alice@example.com",
        country: address.country,
        street: address.street,
        postalCode: address.postalCode,
      });

      yield* deleteUserHandler({ userId: id });

      const found = yield* repo.findOne(UserSpecifications.withId(id));
      deepStrictEqual(found, null);

      const events = yield* rec.byTag<UserDeleted>("UserDeleted");
      deepStrictEqual(events.length, 1);
      deepStrictEqual(events[0]?.userId, id);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails UserNotFound when the user doesn't exist", () =>
    Effect.gen(function* () {
      const unknownId = UserId.make("00000000-0000-0000-0000-000000000000");
      const exit = yield* Effect.exit(deleteUserHandler({ userId: unknownId }));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof UserNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("does not publish a UserDeleted event when the lookup fails", () =>
    Effect.gen(function* () {
      const rec = yield* RecordedEvents;
      const unknownId = UserId.make("00000000-0000-0000-0000-000000000000");
      yield* Effect.exit(deleteUserHandler({ userId: unknownId }));
      const events = yield* rec.byTag<UserDeleted>("UserDeleted");
      deepStrictEqual(events.length, 0);
    }).pipe(Effect.provide(TestLayer)),
  );
});
