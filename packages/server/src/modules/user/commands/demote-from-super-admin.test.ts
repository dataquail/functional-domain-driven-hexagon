import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { UserNotFound } from "@/modules/user/domain/user-errors.js";
import { type UserDemotedFromSuperAdmin } from "@/modules/user/domain/user-events.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import { Address } from "@/modules/user/domain/value-objects/address.js";
import { UserRepositoryFake } from "@/modules/user/infrastructure/user-repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

import { createUser } from "./create-user.js";
import { CreateUserCommand } from "./create-user-command.js";
import { demoteFromSuperAdmin } from "./demote-from-super-admin.js";
import { DemoteFromSuperAdminCommand } from "./demote-from-super-admin-command.js";
import { promoteToSuperAdmin } from "./promote-to-super-admin.js";
import { PromoteToSuperAdminCommand } from "./promote-to-super-admin-command.js";

const TestLayer = Layer.mergeAll(UserRepositoryFake, RecordingEventBus, IdentityUnitOfWork);

const address = Address.make({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

describe("demoteFromSuperAdmin", () => {
  it.effect("flips is_super_admin to false and publishes UserDemotedFromSuperAdmin", () =>
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
      yield* promoteToSuperAdmin(PromoteToSuperAdminCommand.make({ userId: id }));

      yield* demoteFromSuperAdmin(DemoteFromSuperAdminCommand.make({ userId: id }));

      const stored = yield* repo.findById(id);
      deepStrictEqual(stored.isSuperAdmin, false);

      const events = yield* rec.byTag<UserDemotedFromSuperAdmin>("UserDemotedFromSuperAdmin");
      deepStrictEqual(events.length, 1);
      deepStrictEqual(events[0]?.userId, id);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails UserNotFound when the user doesn't exist", () =>
    Effect.gen(function* () {
      const unknownId = UserId.make("00000000-0000-0000-0000-000000000000");
      const exit = yield* Effect.exit(
        demoteFromSuperAdmin(DemoteFromSuperAdminCommand.make({ userId: unknownId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof UserNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
