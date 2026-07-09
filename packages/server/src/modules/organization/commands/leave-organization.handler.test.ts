import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization.command.js";
import { createOrganization } from "@/modules/organization/commands/create-organization.handler.js";
import { LeaveOrganizationCommand } from "@/modules/organization/commands/leave-organization.command.js";
import { leaveOrganization } from "@/modules/organization/commands/leave-organization.handler.js";
import { MembershipNotFound } from "@/modules/organization/domain/membership.errors.js";
import { type MembershipRevoked } from "@/modules/organization/domain/membership.events.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership.repository.js";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/repositories/membership.repository-fake.js";
import { OrganizationRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization.repository-fake.js";
import { OrganizationRolesRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";
import { makeRoleServiceFake } from "@/test-utils/role-service-fake.js";

const userId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

const TestLayer = Layer.mergeAll(
  OrganizationRepositoryFake,
  MembershipRepositoryFake,
  OrganizationRolesRepositoryFake,
  RecordingEventBus,
  IdentityUnitOfWork,
  // Seed `createOrganization` calls need `RoleService`; defaulting to
  // "caller has no platform roles" matches the regular-user path.
  makeRoleServiceFake(new Map()),
);

describe("leaveOrganization", () => {
  it.effect("deletes the caller's membership and publishes MembershipRevoked", () =>
    Effect.gen(function* () {
      const memberships = yield* MembershipRepository;
      const rec = yield* RecordedEvents;
      const orgId = yield* createOrganization(
        CreateOrganizationCommand.make({ name: "Acme", actorUserId: userId }),
      );

      yield* leaveOrganization(LeaveOrganizationCommand.make({ userId, organizationId: orgId }));

      const exit = yield* Effect.exit(memberships.findOneByUserIdAndOrgId(userId, orgId));
      deepStrictEqual(Exit.isFailure(exit), true);

      const events = yield* rec.byTag<MembershipRevoked>("MembershipRevoked");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected MembershipRevoked event");
      deepStrictEqual(event.userId, userId);
      deepStrictEqual(event.organizationId, orgId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails MembershipNotFound when the caller isn't a member", () =>
    Effect.gen(function* () {
      const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
      const exit = yield* Effect.exit(
        leaveOrganization(LeaveOrganizationCommand.make({ userId, organizationId: orgId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof MembershipNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
