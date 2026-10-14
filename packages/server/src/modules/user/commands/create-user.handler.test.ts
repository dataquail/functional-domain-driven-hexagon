import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertDefined, assertNone } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { UserAlreadyExists } from "@/modules/user/domain/user/user.errors.ts";
import { type UserCreated } from "@/modules/user/domain/user/user.events.ts";
import { UserRepository } from "@/modules/user/domain/user/user.repository.ts";
import { UserSpecifications } from "@/modules/user/domain/user/user.specification.ts";
import { UserRepositoryFake } from "@/modules/user/infrastructure/repositories/user.repository-fake.ts";
import { CryptoFake } from "@/test-utils/crypto-fake.ts";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.ts";

import { createUserHandler } from "./create-user.handler.ts";

const TestLayer = Layer.mergeAll(
  UserRepositoryFake,
  RecordingEventBus,
  PassThroughUnitOfWork,
  CryptoFake,
);

const baseCmd = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
};

describe("createUserHandler", () => {
  it.effect("inserts a user and returns the generated id", () =>
    Effect.gen(function* () {
      const repo = yield* UserRepository;
      const id = yield* createUserHandler(baseCmd);

      const stored = yield* Effect.map(
        repo.findOne(UserSpecifications.withId(id)),
        Option.getOrThrow,
      );

      deepStrictEqual(stored.email, "alice@example.com");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("publishes exactly one UserCreated event carrying the email and address", () =>
    Effect.gen(function* () {
      const rec = yield* RecordedEvents;
      yield* createUserHandler(baseCmd);
      const events = yield* rec.byTag<UserCreated>("UserCreated");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      assertDefined(event);
      deepStrictEqual(event.email, "alice@example.com");
      deepStrictEqual(
        Option.map(event.address, (address) => address.country),
        Option.some("USA"),
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("provisions an address-less user when no address fields are given (JIT path)", () =>
    Effect.gen(function* () {
      const repo = yield* UserRepository;
      const id = yield* createUserHandler({ email: "jit@example.com" });

      const stored = yield* Effect.map(
        repo.findOne(UserSpecifications.withId(id)),
        Option.getOrThrow,
      );

      deepStrictEqual(stored.email, "jit@example.com");
      assertNone(stored.address);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails UserAlreadyExists when the email is taken", () =>
    Effect.gen(function* () {
      yield* createUserHandler(baseCmd);
      const error = yield* Effect.flip(createUserHandler(baseCmd));

      deepStrictEqual(Schema.is(UserAlreadyExists)(error), true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("does not publish an event when insert fails", () =>
    Effect.gen(function* () {
      const rec = yield* RecordedEvents;
      yield* createUserHandler(baseCmd);
      yield* Effect.exit(createUserHandler(baseCmd));
      const events = yield* rec.byTag<UserCreated>("UserCreated");
      deepStrictEqual(events.length, 1);
    }).pipe(Effect.provide(TestLayer)),
  );
});
