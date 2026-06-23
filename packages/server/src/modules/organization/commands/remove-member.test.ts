import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { createOrganization } from "@/modules/organization/commands/create-organization.js";
import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization-command.js";
import { removeMember } from "@/modules/organization/commands/remove-member.js";
import { RemoveMemberCommand } from "@/modules/organization/commands/remove-member-command.js";
import * as Membership from "@/modules/organization/domain/membership.aggregate.js";
import { MembershipNotFound } from "@/modules/organization/domain/membership-errors.js";
import { type MembershipRevoked } from "@/modules/organization/domain/membership-events.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership-repository.js";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/membership-repository-fake.js";
import { OrganizationRepositoryFake } from "@/modules/organization/infrastructure/organization-repository-fake.js";
import { OrganizationRolesRepositoryFake } from "@/modules/organization/infrastructure/organization-roles-repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";
import { makeRoleServiceFake } from "@/test-utils/role-service-fake.js";

const actorUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const otherUserId = UserId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

const TestLayer = Layer.mergeAll(
  OrganizationRepositoryFake,
  MembershipRepositoryFake,
  OrganizationRolesRepositoryFake,
  RecordingEventBus,
  IdentityUnitOfWork,
  makeRoleServiceFake(new Map()),
);

describe("removeMember", () => {
  it.effect("deletes the membership and publishes MembershipRevoked", () =>
    Effect.gen(function* () {
      const memberships = yield* MembershipRepository;
      const rec = yield* RecordedEvents;
      const orgId = yield* createOrganization(
        CreateOrganizationCommand.make({ name: "Acme", actorUserId }),
      );
      // Seed a second member directly via the repo — Phase 3 wires
      // AcceptInvitation as the production add-member path, but this
      // test isolates the removal use case from the invitation flow.
      const { membership: secondMember } = Membership.create({
        userId: otherUserId,
        organizationId: orgId,
        now: DateTime.unsafeMake(new Date("2026-02-01T00:00:00Z")),
      });
      yield* memberships.insert(secondMember);

      yield* removeMember(
        RemoveMemberCommand.make({
          targetUserId: otherUserId,
          organizationId: orgId,
          actorUserId,
        }),
      );

      const exit = yield* Effect.exit(memberships.findByUserIdAndOrgId(otherUserId, orgId));
      deepStrictEqual(Exit.isFailure(exit), true);

      const events = yield* rec.byTag<MembershipRevoked>("MembershipRevoked");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected MembershipRevoked event");
      deepStrictEqual(event.userId, otherUserId);
      deepStrictEqual(event.organizationId, orgId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails MembershipNotFound when the user isn't a member", () =>
    Effect.gen(function* () {
      const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
      const exit = yield* Effect.exit(
        removeMember(
          RemoveMemberCommand.make({
            targetUserId: otherUserId,
            organizationId: orgId,
            actorUserId,
          }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof MembershipNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
