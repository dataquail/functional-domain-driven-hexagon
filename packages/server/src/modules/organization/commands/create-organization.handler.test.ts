import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization.command.js";
import { createOrganization } from "@/modules/organization/commands/create-organization.handler.js";
import { type MembershipCreated } from "@/modules/organization/domain/membership.events.js";
import { SuperAdminCannotOwnOrganization } from "@/modules/organization/domain/organization.errors.js";
import { type OrganizationCreated } from "@/modules/organization/domain/organization.events.js";
import { type OrganizationRoleGranted } from "@/modules/organization/domain/organization-role.events.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership.repository.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization.repository.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles.repository.js";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/repositories/membership.repository-fake.js";
import { OrganizationRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization.repository-fake.js";
import { OrganizationRolesRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";
import { makeRoleServiceFake } from "@/test-utils/role-service-fake.js";

const actorUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const superAdminUserId = UserId.make("ssssssss-ssss-ssss-ssss-ssssssssssss");

const TestLayer = Layer.mergeAll(
  OrganizationRepositoryFake,
  MembershipRepositoryFake,
  OrganizationRolesRepositoryFake,
  RecordingEventBus,
  IdentityUnitOfWork,
  // Default: caller is a regular user (no platform roles). The
  // super-admin-rejection test composes its own RoleService fake.
  makeRoleServiceFake(new Map()),
);

describe("createOrganization", () => {
  it.effect("inserts an org, returns the id, publishes OrganizationCreated", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const rec = yield* RecordedEvents;
      const id = yield* createOrganization(
        CreateOrganizationCommand.make({ name: "Acme", actorUserId }),
      );
      const stored = yield* repo.findOneById(id);
      deepStrictEqual(stored.name, "Acme");
      const events = yield* rec.byTag<OrganizationCreated>("OrganizationCreated");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected OrganizationCreated event");
      deepStrictEqual(event.organizationId, id);
      deepStrictEqual(event.name, "Acme");
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("creates a Membership for the creator and publishes MembershipCreated", () =>
    Effect.gen(function* () {
      const memberships = yield* MembershipRepository;
      const rec = yield* RecordedEvents;
      const id = yield* createOrganization(
        CreateOrganizationCommand.make({ name: "Acme", actorUserId }),
      );
      const membership = yield* memberships.findOneByUserIdAndOrgId(actorUserId, id);
      deepStrictEqual(membership.userId, actorUserId);
      deepStrictEqual(membership.organizationId, id);
      const events = yield* rec.byTag<MembershipCreated>("MembershipCreated");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected MembershipCreated event");
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
        const id = yield* createOrganization(
          CreateOrganizationCommand.make({ name: "Acme", actorUserId }),
        );
        const roles = yield* orgRolesRepo.findOneByUserIdAndOrgId(actorUserId, id);
        deepStrictEqual(
          roles.roles.map((r) => ({ role: r.role, issuedBy: r.issuedBy })),
          [{ role: "admin", issuedBy: actorUserId }],
        );
        const events = yield* rec.byTag<OrganizationRoleGranted>("OrganizationRoleGranted");
        deepStrictEqual(events.length, 1);
        const event = events[0];
        if (event === undefined) throw new Error("expected OrganizationRoleGranted event");
        deepStrictEqual(event.userId, actorUserId);
        deepStrictEqual(event.organizationId, id);
        deepStrictEqual(event.role, "admin");
        deepStrictEqual(event.issuedBy, actorUserId);
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("rejects with SuperAdminCannotOwnOrganization when caller is a super-admin", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        createOrganization(
          CreateOrganizationCommand.make({ name: "Acme", actorUserId: superAdminUserId }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof SuperAdminCannotOwnOrganization, true);
      }
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          OrganizationRepositoryFake,
          MembershipRepositoryFake,
          OrganizationRolesRepositoryFake,
          RecordingEventBus,
          IdentityUnitOfWork,
          makeRoleServiceFake(new Map([[superAdminUserId, ["super_admin"]]])),
        ),
      ),
    ),
  );
});
