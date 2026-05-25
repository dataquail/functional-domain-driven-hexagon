import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { createOrganization } from "@/modules/organization/commands/create-organization.js";
import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization-command.js";
import { type OrganizationCreated } from "@/modules/organization/domain/organization-events.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization-repository.js";
import { OrganizationRepositoryFake } from "@/modules/organization/infrastructure/organization-repository-fake.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const TestLayer = Layer.mergeAll(OrganizationRepositoryFake, RecordingEventBus, IdentityUnitOfWork);

describe("createOrganization", () => {
  it.effect("inserts an org, returns the id, publishes OrganizationCreated", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const rec = yield* RecordedEvents;
      const id = yield* createOrganization(CreateOrganizationCommand.make({ name: "Acme" }));
      const stored = yield* repo.findById(id);
      deepStrictEqual(stored.name, "Acme");
      const events = yield* rec.byTag<OrganizationCreated>("OrganizationCreated");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected OrganizationCreated event");
      deepStrictEqual(event.organizationId, id);
      deepStrictEqual(event.name, "Acme");
    }).pipe(Effect.provide(TestLayer)),
  );
});
