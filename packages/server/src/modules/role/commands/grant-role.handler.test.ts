import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertDefined, assertTrue } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { grantRoleHandler } from "@/modules/role/commands/grant-role.handler.ts";
import { AlreadyHasRole, CannotPromoteSelf } from "@/modules/role/domain/roles/role.errors.ts";
import { type RoleGranted } from "@/modules/role/domain/roles/role.events.ts";
import { RolesRepository } from "@/modules/role/domain/roles/roles.repository.ts";
import { RolesSpecifications } from "@/modules/role/domain/roles/roles.specification.ts";
import { RolesRepositoryFake } from "@/modules/role/infrastructure/repositories/roles.repository-fake.ts";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.ts";

const TestLayer = Layer.mergeAll(RolesRepositoryFake, RecordingEventBus, PassThroughUnitOfWork);

const targetId = UserId.make("11111111-1111-1111-1111-111111111111");
const actorId = UserId.make("99999999-9999-9999-9999-999999999999");

describe("grantRoleHandler", () => {
  it.effect("persists the role and publishes RoleGranted", () =>
    Effect.gen(function* () {
      const repo = yield* RolesRepository;
      const rec = yield* RecordedEvents;

      yield* grantRoleHandler({ userId: targetId, role: "super_admin", actorUserId: actorId });

      const roles = yield* Effect.fromOption(
        yield* repo.findOne(RolesSpecifications.forUser(targetId)),
      );

      deepStrictEqual([...roles.roles], ["super_admin"]);

      const events = yield* rec.byTag<RoleGranted>("RoleGranted");
      deepStrictEqual(events.length, 1);
      const [event] = events;
      assertDefined(event);
      deepStrictEqual(event.userId, targetId);
      deepStrictEqual(event.role, "super_admin");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails CannotPromoteSelf when actor equals target", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        grantRoleHandler({ userId: targetId, role: "super_admin", actorUserId: targetId }),
      );

      assertTrue(Schema.is(CannotPromoteSelf)(error));
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails AlreadyHasRole when the role is already granted", () =>
    Effect.gen(function* () {
      yield* grantRoleHandler({ userId: targetId, role: "super_admin", actorUserId: actorId });

      const error = yield* Effect.flip(
        grantRoleHandler({ userId: targetId, role: "super_admin", actorUserId: actorId }),
      );

      assertTrue(Schema.is(AlreadyHasRole)(error));
    }).pipe(Effect.provide(TestLayer)),
  );
});
