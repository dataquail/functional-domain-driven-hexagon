import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertDefined, assertNone } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { UserId } from "@/globals/application/ddd/ids/user-id";
import { Spec } from "@/globals/application/ddd/specification";
import { createOrganizationHandler } from "@/modules/organization/commands/create-organization.handler";
import { leaveOrganizationHandler } from "@/modules/organization/commands/leave-organization.handler";
import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors";
import { type MembershipRevoked } from "@/modules/organization/domain/membership/membership.events";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification";
import { makePlatformRolesFake } from "@/modules/organization/infrastructure/acl/platform-roles.acl-fake";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/repositories/membership.repository-fake";
import { OrganizationRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization.repository-fake";
import { OrganizationRolesRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-fake";
import { CryptoFake } from "@/test-utils/crypto-fake";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus";

const userId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

const TestLayer = Layer.mergeAll(
  CryptoFake,
  OrganizationRepositoryFake,
  MembershipRepositoryFake,
  OrganizationRolesRepositoryFake,
  RecordingEventBus,
  PassThroughUnitOfWork,
  // Seed `createOrganizationHandler` calls need `PlatformRoles`; defaulting to
  // "caller has no platform roles" matches the regular-user path.
  makePlatformRolesFake(),
);

describe("leaveOrganizationHandler", () => {
  it.effect("deletes the caller's membership and publishes MembershipRevoked", () =>
    Effect.gen(function* () {
      const memberships = yield* MembershipRepository;
      const rec = yield* RecordedEvents;
      const orgId = yield* createOrganizationHandler({ name: "Acme", actorUserId: userId });

      yield* leaveOrganizationHandler({ userId, organizationId: orgId });

      const found = yield* memberships.findOne(
        Spec.and(
          MembershipSpecifications.forUser(userId),
          MembershipSpecifications.forOrganization(orgId),
        ),
      );

      assertNone(found);

      const events = yield* rec.byTag<MembershipRevoked>("MembershipRevoked");
      deepStrictEqual(events.length, 1);
      const event = events[0];

      assertDefined(event);
      deepStrictEqual(event.userId, userId);
      deepStrictEqual(event.organizationId, orgId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails MembershipNotFound when the caller isn't a member", () =>
    Effect.gen(function* () {
      const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
      const error = yield* Effect.flip(leaveOrganizationHandler({ userId, organizationId: orgId }));
      deepStrictEqual(Schema.is(MembershipNotFound)(error), true);
    }).pipe(Effect.provide(TestLayer)),
  );
});
