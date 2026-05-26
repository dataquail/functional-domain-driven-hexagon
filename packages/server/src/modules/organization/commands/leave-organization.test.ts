import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { createOrganization } from "@/modules/organization/commands/create-organization.js";
import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization-command.js";
import { leaveOrganization } from "@/modules/organization/commands/leave-organization.js";
import { LeaveOrganizationCommand } from "@/modules/organization/commands/leave-organization-command.js";
import { MembershipNotFound } from "@/modules/organization/domain/membership-errors.js";
import { type MembershipRevoked } from "@/modules/organization/domain/membership-events.js";
import { MembershipRepository } from "@/modules/organization/domain/membership-repository.js";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/membership-repository-fake.js";
import { OrganizationRepositoryFake } from "@/modules/organization/infrastructure/organization-repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const userId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

const TestLayer = Layer.mergeAll(
  OrganizationRepositoryFake,
  MembershipRepositoryFake,
  RecordingEventBus,
  IdentityUnitOfWork,
);

describe("leaveOrganization", () => {
  it.effect("deletes the caller's membership and publishes MembershipRevoked", () =>
    Effect.gen(function* () {
      const memberships = yield* MembershipRepository;
      const rec = yield* RecordedEvents;
      const orgId = yield* createOrganization(
        CreateOrganizationCommand.make({ name: "Acme", actorUserId: userId }),
      );

      yield* leaveOrganization(LeaveOrganizationCommand.make({ userId, organizationId: orgId }));

      const exit = yield* Effect.exit(memberships.findByUserIdAndOrgId(userId, orgId));
      deepStrictEqual(Exit.isFailure(exit), true);

      const events = yield* rec.byTag<MembershipRevoked>("MembershipRevoked");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected MembershipRevoked event");
      deepStrictEqual(event.userId, userId);
      deepStrictEqual(event.organizationId, orgId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails MembershipNotFound when the caller isn't a member", () =>
    Effect.gen(function* () {
      const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
      const exit = yield* Effect.exit(
        leaveOrganization(LeaveOrganizationCommand.make({ userId, organizationId: orgId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof MembershipNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
