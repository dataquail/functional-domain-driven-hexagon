import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertDefined, assertNone, assertTrue } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { grantRoleHandler } from "@/modules/role/commands/grant-role.handler.ts";
import { revokeRoleHandler } from "@/modules/role/commands/revoke-role.handler.ts";
import { DoesNotHaveRole } from "@/modules/role/domain/roles/role.errors.ts";
import { type RoleRevoked } from "@/modules/role/domain/roles/role.events.ts";
import { RolesRepository } from "@/modules/role/domain/roles/roles.repository.ts";
import { RolesSpecifications } from "@/modules/role/domain/roles/roles.specification.ts";
import { RolesRepositoryFake } from "@/modules/role/infrastructure/repositories/roles.repository-fake.ts";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.ts";

const TestLayer = Layer.mergeAll(RolesRepositoryFake, RecordingEventBus, PassThroughUnitOfWork);

const targetId = UserId.make("11111111-1111-1111-1111-111111111111");
const actorId = UserId.make("99999999-9999-9999-9999-999999999999");

describe("revokeRoleHandler", () => {
  it.effect("removes the role and publishes RoleRevoked", () =>
    Effect.gen(function* () {
      const repo = yield* RolesRepository;
      const rec = yield* RecordedEvents;

      yield* grantRoleHandler({ userId: targetId, role: "super_admin", actorUserId: actorId });
      yield* revokeRoleHandler({ userId: targetId, role: "super_admin" });

      // Revoking the only role leaves no rows, so the aggregate no longer
      // resolves — findOne reports none (no rows = no roles).
      assertNone(yield* repo.findOne(RolesSpecifications.forUser(targetId)));

      const events = yield* rec.byTag<RoleRevoked>("RoleRevoked");
      deepStrictEqual(events.length, 1);
      const [event] = events;
      assertDefined(event);
      deepStrictEqual(event.userId, targetId);
      deepStrictEqual(event.role, "super_admin");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails DoesNotHaveRole when the role isn't held", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        revokeRoleHandler({ userId: targetId, role: "super_admin" }),
      );

      assertTrue(Schema.is(DoesNotHaveRole)(error));
    }).pipe(Effect.provide(TestLayer)),
  );
});
