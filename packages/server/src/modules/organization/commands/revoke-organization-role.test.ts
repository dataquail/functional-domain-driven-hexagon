import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { grantOrganizationRole } from "@/modules/organization/commands/grant-organization-role.js";
import { GrantOrganizationRoleCommand } from "@/modules/organization/commands/grant-organization-role-command.js";
import { revokeOrganizationRole } from "@/modules/organization/commands/revoke-organization-role.js";
import { RevokeOrganizationRoleCommand } from "@/modules/organization/commands/revoke-organization-role-command.js";
import { DoesNotHaveOrganizationRole } from "@/modules/organization/domain/organization-role-errors.js";
import { type OrganizationRoleRevoked } from "@/modules/organization/domain/organization-role-events.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles-repository.js";
import { OrganizationRolesRepositoryFake } from "@/modules/organization/infrastructure/organization-roles-repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const TestLayer = Layer.mergeAll(
  OrganizationRolesRepositoryFake,
  RecordingEventBus,
  IdentityUnitOfWork,
);

const targetId = UserId.make("11111111-1111-1111-1111-111111111111");
const actorId = UserId.make("99999999-9999-9999-9999-999999999999");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");

describe("revokeOrganizationRole", () => {
  it.effect("removes the role and publishes OrganizationRoleRevoked", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRolesRepository;
      const rec = yield* RecordedEvents;

      yield* grantOrganizationRole(
        GrantOrganizationRoleCommand.make({
          userId: targetId,
          organizationId: orgId,
          role: "admin",
          actorUserId: actorId,
        }),
      );

      yield* revokeOrganizationRole(
        RevokeOrganizationRoleCommand.make({
          userId: targetId,
          organizationId: orgId,
          role: "admin",
        }),
      );

      const roles = yield* repo.findByUserIdAndOrgId(targetId, orgId);
      deepStrictEqual([...roles.roles], []);

      const events = yield* rec.byTag<OrganizationRoleRevoked>("OrganizationRoleRevoked");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected OrganizationRoleRevoked event");
      deepStrictEqual(event.userId, targetId);
      deepStrictEqual(event.organizationId, orgId);
      deepStrictEqual(event.role, "admin");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails DoesNotHaveOrganizationRole when the role isn't held", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        revokeOrganizationRole(
          RevokeOrganizationRoleCommand.make({
            userId: targetId,
            organizationId: orgId,
            role: "admin",
          }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof DoesNotHaveOrganizationRole, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
