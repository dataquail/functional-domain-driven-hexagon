import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { createOrganizationHandler } from "@/modules/organization/commands/create-organization.handler.js";
import { removeMemberHandler } from "@/modules/organization/commands/remove-member.handler.js";
import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { type MembershipRevoked } from "@/modules/organization/domain/membership/membership.events.js";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.js";
import { MembershipRootOps } from "@/modules/organization/domain/membership/membership.root-ops.js";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification.js";
import { makePlatformRolesFake } from "@/modules/organization/infrastructure/acl/platform-roles.acl-fake.js";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/repositories/membership.repository-fake.js";
import { OrganizationRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization.repository-fake.js";
import { OrganizationRolesRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-fake.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const actorUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const otherUserId = UserId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

const TestLayer = Layer.mergeAll(
  OrganizationRepositoryFake,
  MembershipRepositoryFake,
  OrganizationRolesRepositoryFake,
  RecordingEventBus,
  PassThroughUnitOfWork,
  makePlatformRolesFake(),
);

describe("removeMemberHandler", () => {
  it.effect("deletes the membership and publishes MembershipRevoked", () =>
    Effect.gen(function* () {
      const memberships = yield* MembershipRepository;
      const rec = yield* RecordedEvents;
      const orgId = yield* createOrganizationHandler({ name: "Acme", actorUserId });
      // Seed a second member directly via the repo — Phase 3 wires
      // AcceptInvitationCommand as the production add-member path, but this
      // test isolates the removal use case from the invitation flow.
      const { membership: secondMember } = MembershipRootOps.create({
        userId: otherUserId,
        organizationId: orgId,
        now: DateTime.makeUnsafe(new Date("2026-02-01T00:00:00Z")),
      });
      yield* memberships.insertOne(secondMember);

      yield* removeMemberHandler({
        targetUserId: otherUserId,
        organizationId: orgId,
        actorUserId,
      });

      const found = yield* memberships.findOne(
        Spec.and(
          MembershipSpecifications.forUser(otherUserId),
          MembershipSpecifications.forOrganization(orgId),
        ),
      );
      deepStrictEqual(found, null);

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
        removeMemberHandler({
          targetUserId: otherUserId,
          organizationId: orgId,
          actorUserId,
        }),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof MembershipNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
