import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { createOrganization } from "@/modules/organization/commands/create-organization.js";
import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization-command.js";
import { softDeleteOrganization } from "@/modules/organization/commands/soft-delete-organization.js";
import { SoftDeleteOrganizationCommand } from "@/modules/organization/commands/soft-delete-organization-command.js";
import { OrganizationNotFound } from "@/modules/organization/domain/organization-errors.js";
import { type OrganizationSoftDeleted } from "@/modules/organization/domain/organization-events.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization-repository.js";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/membership-repository-fake.js";
import { OrganizationRepositoryFake } from "@/modules/organization/infrastructure/organization-repository-fake.js";
import { OrganizationRolesRepositoryFake } from "@/modules/organization/infrastructure/organization-roles-repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const actorUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

const TestLayer = Layer.mergeAll(
  OrganizationRepositoryFake,
  MembershipRepositoryFake,
  OrganizationRolesRepositoryFake,
  RecordingEventBus,
  IdentityUnitOfWork,
);

describe("softDeleteOrganization", () => {
  it.effect("tombstones the org and publishes OrganizationSoftDeleted", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const rec = yield* RecordedEvents;
      const id = yield* createOrganization(
        CreateOrganizationCommand.make({ name: "Acme", actorUserId }),
      );
      yield* softDeleteOrganization(SoftDeleteOrganizationCommand.make({ organizationId: id }));
      const stored = yield* repo.findByIdIncludingDeleted(id);
      deepStrictEqual(stored.deletedAt !== null, true);
      const events = yield* rec.byTag<OrganizationSoftDeleted>("OrganizationSoftDeleted");
      deepStrictEqual(events.length, 1);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails OrganizationNotFound when the org doesn't exist", () =>
    Effect.gen(function* () {
      const unknown = OrganizationId.make("00000000-0000-0000-0000-000000000000");
      const exit = yield* Effect.exit(
        softDeleteOrganization(SoftDeleteOrganizationCommand.make({ organizationId: unknown })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof OrganizationNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails OrganizationNotFound when the org is already soft-deleted", () =>
    Effect.gen(function* () {
      const id = yield* createOrganization(
        CreateOrganizationCommand.make({ name: "Acme", actorUserId }),
      );
      yield* softDeleteOrganization(SoftDeleteOrganizationCommand.make({ organizationId: id }));
      const exit = yield* Effect.exit(
        softDeleteOrganization(SoftDeleteOrganizationCommand.make({ organizationId: id })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof OrganizationNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
