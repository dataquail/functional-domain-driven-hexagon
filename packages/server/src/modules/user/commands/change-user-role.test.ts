import { UserNotFound } from "@/modules/user/domain/user-errors.js";
import { type UserRoleChanged } from "@/modules/user/domain/user-events.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import { Address } from "@/modules/user/domain/value-objects/address.js";
import { UserRepositoryFake } from "@/modules/user/infrastructure/user-repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityTransactionRunner } from "@/test-utils/identity-transaction-runner.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { ChangeUserRoleCommand } from "./change-user-role-command.js";
import { changeUserRole } from "./change-user-role.js";
import { CreateUserCommand } from "./create-user-command.js";
import { createUser } from "./create-user.js";

const TestLayer = Layer.mergeAll(UserRepositoryFake, RecordingEventBus, IdentityTransactionRunner);

const address = Address.make({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

describe("changeUserRole", () => {
  it.effect("promotes to admin and publishes UserRoleChanged with oldRole 'guest'", () =>
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

      yield* changeUserRole(ChangeUserRoleCommand.make({ userId: id, role: "admin" }));

      const stored = yield* repo.findById(id);
      deepStrictEqual(stored.role, "admin");

      const events = yield* rec.byTag<UserRoleChanged>("UserRoleChanged");
      deepStrictEqual(events.length, 1);
      deepStrictEqual(events[0]?.oldRole, "guest");
      deepStrictEqual(events[0].newRole, "admin");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("promotes to moderator", () =>
    Effect.gen(function* () {
      const repo = yield* UserRepository;
      const id = yield* createUser(
        CreateUserCommand.make({
          email: "alice@example.com",
          country: address.country,
          street: address.street,
          postalCode: address.postalCode,
        }),
      );
      yield* changeUserRole(ChangeUserRoleCommand.make({ userId: id, role: "moderator" }));
      const stored = yield* repo.findById(id);
      deepStrictEqual(stored.role, "moderator");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails UserNotFound when the user doesn't exist", () =>
    Effect.gen(function* () {
      const unknownId = UserId.make("00000000-0000-0000-0000-000000000000");
      const exit = yield* Effect.exit(
        changeUserRole(ChangeUserRoleCommand.make({ userId: unknownId, role: "admin" })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof UserNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
