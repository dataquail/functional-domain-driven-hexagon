import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { createOrganization } from "@/modules/organization/commands/create-organization.js";
import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization-command.js";
import { restoreOrganization } from "@/modules/organization/commands/restore-organization.js";
import { RestoreOrganizationCommand } from "@/modules/organization/commands/restore-organization-command.js";
import { softDeleteOrganization } from "@/modules/organization/commands/soft-delete-organization.js";
import { SoftDeleteOrganizationCommand } from "@/modules/organization/commands/soft-delete-organization-command.js";
import {
  OrganizationNotDeleted,
  OrganizationNotFound,
} from "@/modules/organization/domain/organization-errors.js";
import { type OrganizationRestored } from "@/modules/organization/domain/organization-events.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization-repository.js";
import { OrganizationRepositoryFake } from "@/modules/organization/infrastructure/organization-repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const TestLayer = Layer.mergeAll(OrganizationRepositoryFake, RecordingEventBus, IdentityUnitOfWork);

describe("restoreOrganization", () => {
  it.effect("clears the tombstone and publishes OrganizationRestored", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const rec = yield* RecordedEvents;
      const id = yield* createOrganization(CreateOrganizationCommand.make({ name: "Acme" }));
      yield* softDeleteOrganization(SoftDeleteOrganizationCommand.make({ organizationId: id }));
      yield* restoreOrganization(RestoreOrganizationCommand.make({ organizationId: id }));
      const stored = yield* repo.findById(id);
      deepStrictEqual(stored.deletedAt, null);
      const events = yield* rec.byTag<OrganizationRestored>("OrganizationRestored");
      deepStrictEqual(events.length, 1);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails OrganizationNotFound when the org doesn't exist", () =>
    Effect.gen(function* () {
      const unknown = OrganizationId.make("00000000-0000-0000-0000-000000000000");
      const exit = yield* Effect.exit(
        restoreOrganization(RestoreOrganizationCommand.make({ organizationId: unknown })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof OrganizationNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails OrganizationNotDeleted when the org is still active", () =>
    Effect.gen(function* () {
      const id = yield* createOrganization(CreateOrganizationCommand.make({ name: "Acme" }));
      const exit = yield* Effect.exit(
        restoreOrganization(RestoreOrganizationCommand.make({ organizationId: id })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof OrganizationNotDeleted, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
