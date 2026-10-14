import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertDefined, assertNone } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { Spec } from "@/globals/application/ddd/specification.ts";
import { grantOrganizationRoleHandler } from "@/modules/organization/commands/grant-organization-role.handler.ts";
import { revokeOrganizationRoleHandler } from "@/modules/organization/commands/revoke-organization-role.handler.ts";
import { DoesNotHaveOrganizationRole } from "@/modules/organization/domain/organization-roles/organization-role.errors.ts";
import { type OrganizationRoleRevoked } from "@/modules/organization/domain/organization-roles/organization-role.events.ts";
import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.ts";
import { OrganizationRolesSpecifications } from "@/modules/organization/domain/organization-roles/organization-roles.specification.ts";
import { OrganizationRolesRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-fake.ts";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.ts";

const TestLayer = Layer.mergeAll(
  OrganizationRolesRepositoryFake,
  RecordingEventBus,
  PassThroughUnitOfWork,
);

const targetId = UserId.make("11111111-1111-1111-1111-111111111111");
const actorId = UserId.make("99999999-9999-9999-9999-999999999999");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");

describe("revokeOrganizationRoleHandler", () => {
  it.effect("removes the role and publishes OrganizationRoleRevoked", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRolesRepository;
      const rec = yield* RecordedEvents;

      yield* grantOrganizationRoleHandler({
        userId: targetId,
        organizationId: orgId,
        role: "admin",
        actorUserId: actorId,
      });

      yield* revokeOrganizationRoleHandler({
        userId: targetId,
        organizationId: orgId,
        role: "admin",
      });

      // Revoking the only role leaves no rows, so the aggregate no longer
      // resolves — findOne reports null (no rows = no roles).
      const roles = yield* repo.findOne(
        Spec.and(
          OrganizationRolesSpecifications.forUser(targetId),
          OrganizationRolesSpecifications.forOrganization(orgId),
        ),
      );

      assertNone(roles);

      const events = yield* rec.byTag<OrganizationRoleRevoked>("OrganizationRoleRevoked");
      deepStrictEqual(events.length, 1);
      const event = events[0];

      assertDefined(event);
      deepStrictEqual(event.userId, targetId);
      deepStrictEqual(event.organizationId, orgId);
      deepStrictEqual(event.role, "admin");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails DoesNotHaveOrganizationRole when the role isn't held", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        revokeOrganizationRoleHandler({
          userId: targetId,
          organizationId: orgId,
          role: "admin",
        }),
      );

      deepStrictEqual(Schema.is(DoesNotHaveOrganizationRole)(error), true);
    }).pipe(Effect.provide(TestLayer)),
  );
});
