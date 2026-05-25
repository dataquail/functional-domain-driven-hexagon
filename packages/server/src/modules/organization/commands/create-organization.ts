import * as crypto from "node:crypto";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type CreateOrganizationCommand,
  type CreateOrganizationOutput,
} from "@/modules/organization/commands/create-organization-command.js";
import * as Organization from "@/modules/organization/domain/organization.aggregate.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization-repository.js";
import { DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const createOrganization = (cmd: CreateOrganizationCommand): CreateOrganizationOutput =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;
    const now = yield* DateTime.now;
    const id = OrganizationId.make(crypto.randomUUID());
    const { events, organization } = Organization.create({ id, name: cmd.name, now });
    yield* uow
      .run(
        Effect.gen(function* () {
          yield* repo.insert(organization);
          yield* bus.dispatch(events);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
    return id;
  });
