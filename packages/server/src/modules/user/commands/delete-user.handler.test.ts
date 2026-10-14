import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { UserNotFound } from "@/modules/user/domain/user/user.errors.ts";
import { type UserDeleted } from "@/modules/user/domain/user/user.events.ts";
import { UserRepository } from "@/modules/user/domain/user/user.repository.ts";
import { UserSpecifications } from "@/modules/user/domain/user/user.specification.ts";
import { AddressValueObject } from "@/modules/user/domain/user/value-objects/address.value-object.ts";
import { UserRepositoryFake } from "@/modules/user/infrastructure/repositories/user.repository-fake.ts";
import { CryptoFake } from "@/test-utils/crypto-fake.ts";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.ts";

import { createUserHandler } from "./create-user.handler.ts";
import { deleteUserHandler } from "./delete-user.handler.ts";

const TestLayer = Layer.mergeAll(
  UserRepositoryFake,
  RecordingEventBus,
  PassThroughUnitOfWork,
  CryptoFake,
);

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
      assertNone(found);

      const events = yield* rec.byTag<UserDeleted>("UserDeleted");
      deepStrictEqual(events.length, 1);
      deepStrictEqual(events[0]?.userId, id);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails UserNotFound when the user doesn't exist", () =>
    Effect.gen(function* () {
      const unknownId = UserId.make("00000000-0000-0000-0000-000000000000");
      const error = yield* Effect.flip(deleteUserHandler({ userId: unknownId }));

      deepStrictEqual(Schema.is(UserNotFound)(error), true);
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
