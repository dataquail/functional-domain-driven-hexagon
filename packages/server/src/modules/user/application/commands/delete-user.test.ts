import { UserNotFound } from "@/modules/user/domain/user-errors.js";
import { type UserDeleted } from "@/modules/user/domain/user-events.js";
import { UserId } from "@/modules/user/domain/user-id.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import { Address } from "@/modules/user/domain/value-objects/address.js";
import { UserRepositoryFake } from "@/modules/user/infrastructure/user-repository-fake.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { createUser, CreateUserCommand } from "./create-user.js";
import { deleteUser, DeleteUserCommand } from "./delete-user.js";

const TestLayer = Layer.mergeAll(UserRepositoryFake, RecordingEventBus);

const address = Address.make({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

describe("deleteUser", () => {
  it.effect("removes the user and publishes UserDeleted", () =>
    Effect.gen(function* () {
      const repo = yield* UserRepository;
      const rec = yield* RecordedEvents;
      const id = yield* createUser(
        CreateUserCommand.make({
          email: "alice@example.com",
          country: address.country,
          street: address.street,
          postalCode: address.postalCode,
        }),
      );

      yield* deleteUser(DeleteUserCommand.make({ userId: id }));

      const exit = yield* Effect.exit(repo.findById(id));
      deepStrictEqual(Exit.isFailure(exit), true);

      const events = yield* rec.byTag<UserDeleted>("UserDeleted");
      deepStrictEqual(events.length, 1);
      deepStrictEqual(events[0]?.userId, id);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails UserNotFound when the user doesn't exist", () =>
    Effect.gen(function* () {
      const unknownId = UserId.make("00000000-0000-0000-0000-000000000000");
      const exit = yield* Effect.exit(deleteUser(DeleteUserCommand.make({ userId: unknownId })));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof UserNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("does not publish a UserDeleted event when the lookup fails", () =>
    Effect.gen(function* () {
      const rec = yield* RecordedEvents;
      const unknownId = UserId.make("00000000-0000-0000-0000-000000000000");
      yield* Effect.exit(deleteUser(DeleteUserCommand.make({ userId: unknownId })));
      const events = yield* rec.byTag<UserDeleted>("UserDeleted");
      deepStrictEqual(events.length, 0);
    }).pipe(Effect.provide(TestLayer)),
  );
});
