import { UserAlreadyExists } from "@/modules/user/domain/user-errors.js";
import { type UserCreated } from "@/modules/user/domain/user-events.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import { UserRepositoryFake } from "@/modules/user/infrastructure/user-repository-fake.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { createUser, CreateUserCommand } from "./create-user.js";

const TestLayer = Layer.mergeAll(UserRepositoryFake, RecordingEventBus);

const baseCmd = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
};

describe("createUser", () => {
  it.effect("inserts a user and returns the generated id", () =>
    Effect.gen(function* () {
      const repo = yield* UserRepository;
      const id = yield* createUser(CreateUserCommand.make(baseCmd));
      const stored = yield* repo.findById(id);
      deepStrictEqual(stored.email, "alice@example.com");
      deepStrictEqual(stored.role, "guest");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("publishes exactly one UserCreated event carrying the email and address", () =>
    Effect.gen(function* () {
      const rec = yield* RecordedEvents;
      yield* createUser(CreateUserCommand.make(baseCmd));
      const events = yield* rec.byTag<UserCreated>("UserCreated");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected UserCreated event");
      deepStrictEqual(event.email, "alice@example.com");
      deepStrictEqual(event.address.country, "USA");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails UserAlreadyExists when the email is taken", () =>
    Effect.gen(function* () {
      yield* createUser(CreateUserCommand.make(baseCmd));
      const exit = yield* Effect.exit(createUser(CreateUserCommand.make(baseCmd)));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof UserAlreadyExists, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("does not publish an event when insert fails", () =>
    Effect.gen(function* () {
      const rec = yield* RecordedEvents;
      yield* createUser(CreateUserCommand.make(baseCmd));
      yield* Effect.exit(createUser(CreateUserCommand.make(baseCmd)));
      const events = yield* rec.byTag<UserCreated>("UserCreated");
      deepStrictEqual(events.length, 1);
    }).pipe(Effect.provide(TestLayer)),
  );
});
