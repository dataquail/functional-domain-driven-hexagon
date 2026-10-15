import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { Spec } from "@/globals/application/ddd/specification";
import { createOrganizationHandler } from "@/modules/organization/commands/create-organization.handler";
import { type MembershipCreated } from "@/modules/organization/domain/membership/membership.events";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification";
import { SuperAdminCannotOwnOrganization } from "@/modules/organization/domain/organization/organization.errors";
import { type OrganizationCreated } from "@/modules/organization/domain/organization/organization.events";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository";
import { OrganizationSpecifications } from "@/modules/organization/domain/organization/organization.specification";
import { type OrganizationRoleGranted } from "@/modules/organization/domain/organization-roles/organization-role.events";
import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository";
import { OrganizationRolesSpecifications } from "@/modules/organization/domain/organization-roles/organization-roles.specification";
import { makePlatformRolesFake } from "@/modules/organization/infrastructure/acl/platform-roles.acl-fake";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/repositories/membership.repository-fake";
import { OrganizationRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization.repository-fake";
import { OrganizationRolesRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-fake";
import { CryptoFake } from "@/test-utils/crypto-fake";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus";

const actorUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const superAdminUserId = UserId.make("ssssssss-ssss-ssss-ssss-ssssssssssss");

const TestLayer = Layer.mergeAll(
  CryptoFake,
  OrganizationRepositoryFake,
  MembershipRepositoryFake,
  OrganizationRolesRepositoryFake,
  RecordingEventBus,
  PassThroughUnitOfWork,
  // Default: caller is a regular user (no platform roles). The
  // super-admin-rejection test composes its own PlatformRoles fake.
  makePlatformRolesFake(),
);

describe("createOrganizationHandler", () => {
  it.effect("inserts an org, returns the id, publishes OrganizationCreated", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const rec = yield* RecordedEvents;
      const id = yield* createOrganizationHandler({ name: "Acme", actorUserId });
      const maybeStored = yield* repo.findOne(OrganizationSpecifications.withId(id));

      const stored = Option.getOrThrow(maybeStored);
      deepStrictEqual(stored.name, "Acme");
      const events = yield* rec.byTag<OrganizationCreated>("OrganizationCreated");
      deepStrictEqual(events.length, 1);
      const event = events[0];

      assertDefined(event);
      deepStrictEqual(event.organizationId, id);
      deepStrictEqual(event.name, "Acme");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("creates a Membership for the creator and publishes MembershipCreated", () =>
    Effect.gen(function* () {
      const memberships = yield* MembershipRepository;
      const rec = yield* RecordedEvents;
      const id = yield* createOrganizationHandler({ name: "Acme", actorUserId });

      const maybeMembership = yield* memberships.findOne(
        Spec.and(
          MembershipSpecifications.forUser(actorUserId),
          MembershipSpecifications.forOrganization(id),
        ),
      );

      const membership = Option.getOrThrow(maybeMembership);
      deepStrictEqual(membership.userId, actorUserId);
      deepStrictEqual(membership.organizationId, id);
      const events = yield* rec.byTag<MembershipCreated>("MembershipCreated");
      deepStrictEqual(events.length, 1);
      const event = events[0];

      assertDefined(event);
      deepStrictEqual(event.userId, actorUserId);
      deepStrictEqual(event.organizationId, id);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "grants the creator the `admin` OrganizationRole and publishes OrganizationRoleGranted",
    () =>
      Effect.gen(function* () {
        const orgRolesRepo = yield* OrganizationRolesRepository;
        const rec = yield* RecordedEvents;
        const id = yield* createOrganizationHandler({ name: "Acme", actorUserId });

        const maybeRoles = yield* orgRolesRepo.findOne(
          Spec.and(
            OrganizationRolesSpecifications.forUser(actorUserId),
            OrganizationRolesSpecifications.forOrganization(id),
          ),
        );

        const roles = Option.getOrThrow(maybeRoles);
        deepStrictEqual(
          roles.roles.map((r) => ({ role: r.role, issuedBy: r.issuedBy })),
          [{ role: "admin", issuedBy: actorUserId }],
        );
        const events = yield* rec.byTag<OrganizationRoleGranted>("OrganizationRoleGranted");
        deepStrictEqual(events.length, 1);
        const event = events[0];

        assertDefined(event);
        deepStrictEqual(event.userId, actorUserId);
        deepStrictEqual(event.organizationId, id);
        deepStrictEqual(event.role, "admin");
        deepStrictEqual(event.issuedBy, actorUserId);
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("rejects with SuperAdminCannotOwnOrganization when caller is a super-admin", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        createOrganizationHandler({ name: "Acme", actorUserId: superAdminUserId }),
      );

      deepStrictEqual(Schema.is(SuperAdminCannotOwnOrganization)(error), true);
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          CryptoFake,
          OrganizationRepositoryFake,
          MembershipRepositoryFake,
          OrganizationRolesRepositoryFake,
          RecordingEventBus,
          PassThroughUnitOfWork,
          makePlatformRolesFake(new Set([superAdminUserId])),
        ),
      ),
    ),
  );
});
