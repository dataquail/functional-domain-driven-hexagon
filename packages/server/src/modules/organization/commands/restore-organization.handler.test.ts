import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { createOrganizationHandler } from "@/modules/organization/commands/create-organization.handler.ts";
import { restoreOrganizationHandler } from "@/modules/organization/commands/restore-organization.handler.ts";
import { softDeleteOrganizationHandler } from "@/modules/organization/commands/soft-delete-organization.handler.ts";
import {
  OrganizationNotDeleted,
  OrganizationNotFound,
} from "@/modules/organization/domain/organization/organization.errors.ts";
import { type OrganizationRestored } from "@/modules/organization/domain/organization/organization.events.ts";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.ts";
import { OrganizationSpecifications } from "@/modules/organization/domain/organization/organization.specification.ts";
import { makePlatformRolesFake } from "@/modules/organization/infrastructure/acl/platform-roles.acl-fake.ts";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/repositories/membership.repository-fake.ts";
import { OrganizationRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization.repository-fake.ts";
import { OrganizationRolesRepositoryFake } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-fake.ts";
import { CryptoFake } from "@/test-utils/crypto-fake.ts";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.ts";

const actorUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

const TestLayer = Layer.mergeAll(
  CryptoFake,
  OrganizationRepositoryFake,
  MembershipRepositoryFake,
  OrganizationRolesRepositoryFake,
  RecordingEventBus,
  PassThroughUnitOfWork,
  makePlatformRolesFake(),
);

describe("restoreOrganizationHandler", () => {
  it.effect("clears the tombstone and publishes OrganizationRestored", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const rec = yield* RecordedEvents;
      const id = yield* createOrganizationHandler({ name: "Acme", actorUserId });
      yield* softDeleteOrganizationHandler({ organizationId: id });
      yield* restoreOrganizationHandler({ organizationId: id });
      const maybeStored = yield* repo.findOne(OrganizationSpecifications.withId(id));

      const stored = Option.getOrThrow(maybeStored);
      assertNone(stored.deletedAt);
      const events = yield* rec.byTag<OrganizationRestored>("OrganizationRestored");
      deepStrictEqual(events.length, 1);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails OrganizationNotFound when the org doesn't exist", () =>
    Effect.gen(function* () {
      const unknown = OrganizationId.make("00000000-0000-0000-0000-000000000000");
      const error = yield* Effect.flip(restoreOrganizationHandler({ organizationId: unknown }));
      deepStrictEqual(Schema.is(OrganizationNotFound)(error), true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails OrganizationNotDeleted when the org is still active", () =>
    Effect.gen(function* () {
      const id = yield* createOrganizationHandler({ name: "Acme", actorUserId });
      const error = yield* Effect.flip(restoreOrganizationHandler({ organizationId: id }));
      deepStrictEqual(Schema.is(OrganizationNotDeleted)(error), true);
    }).pipe(Effect.provide(TestLayer)),
  );
});
