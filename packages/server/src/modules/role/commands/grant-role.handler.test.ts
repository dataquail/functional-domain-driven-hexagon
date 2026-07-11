import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { GrantRoleCommand } from "@/modules/role/commands/grant-role.command.js";
import { grantRole } from "@/modules/role/commands/grant-role.handler.js";
import { AlreadyHasRole, CannotPromoteSelf } from "@/modules/role/domain/roles/role.errors.js";
import { type RoleGranted } from "@/modules/role/domain/roles/role.events.js";
import { RolesRepository } from "@/modules/role/domain/roles/roles.repository.js";
import { RolesRepositoryFake } from "@/modules/role/infrastructure/repositories/roles.repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const TestLayer = Layer.mergeAll(RolesRepositoryFake, RecordingEventBus, IdentityUnitOfWork);

const targetId = UserId.make("11111111-1111-1111-1111-111111111111");
const actorId = UserId.make("99999999-9999-9999-9999-999999999999");

describe("grantRole", () => {
  it.effect("persists the role and publishes RoleGranted", () =>
    Effect.gen(function* () {
      const repo = yield* RolesRepository;
      const rec = yield* RecordedEvents;

      yield* grantRole(
        GrantRoleCommand.make({ userId: targetId, role: "super_admin", actorUserId: actorId }),
      );

      const roles = yield* repo.findOneByUserId(targetId);
      deepStrictEqual([...roles.roles], ["super_admin"]);

      const events = yield* rec.byTag<RoleGranted>("RoleGranted");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected RoleGranted event");
      deepStrictEqual(event.userId, targetId);
      deepStrictEqual(event.role, "super_admin");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails CannotPromoteSelf when actor equals target", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        grantRole(
          GrantRoleCommand.make({ userId: targetId, role: "super_admin", actorUserId: targetId }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof CannotPromoteSelf, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails AlreadyHasRole when the role is already granted", () =>
    Effect.gen(function* () {
      yield* grantRole(
        GrantRoleCommand.make({ userId: targetId, role: "super_admin", actorUserId: actorId }),
      );
      const exit = yield* Effect.exit(
        grantRole(
          GrantRoleCommand.make({ userId: targetId, role: "super_admin", actorUserId: actorId }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof AlreadyHasRole, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
