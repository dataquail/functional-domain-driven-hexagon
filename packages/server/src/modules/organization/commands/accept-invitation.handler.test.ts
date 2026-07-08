import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { AcceptInvitationCommand } from "@/modules/organization/commands/accept-invitation.command.js";
import { acceptInvitation } from "@/modules/organization/commands/accept-invitation.handler.js";
import {
  InvitationAlreadyAccepted,
  InvitationExpired,
  InvitationRevoked,
  InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation.errors.js";
import {
  type InvitationRoot,
  InvitationRootOps,
} from "@/modules/organization/domain/invitation.root.js";
import { type MembershipCreated } from "@/modules/organization/domain/membership.events.js";
import { SuperAdminCannotOwnOrganization } from "@/modules/organization/domain/organization.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation.repository.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership.repository.js";
import { InvitationRepositoryFake } from "@/modules/organization/infrastructure/repositories/invitation.repository-fake.js";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/repositories/membership.repository-fake.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";
import { makeRoleServiceFake } from "@/test-utils/role-service-fake.js";

const invitationId = InvitationId.make("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const superAdminUserId = UserId.make("ssssssss-ssss-ssss-ssss-ssssssssssss");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));
const inOneWeek = DateTime.makeUnsafe(new Date("2026-01-08T00:00:00Z"));

const seed = (): InvitationRoot =>
  InvitationRootOps.issue({
    id: invitationId,
    organizationId,
    inviteeEmail: "alice@example.com",
    token: "tok-abc",
    expiresAt: inOneWeek,
    now,
  }).invitation;

const TestLayer = Layer.mergeAll(
  InvitationRepositoryFake,
  MembershipRepositoryFake,
  RecordingEventBus,
  IdentityUnitOfWork,
  // Default: caller is a regular user. The super-admin-rejection test
  // composes its own RoleService fake.
  makeRoleServiceFake(new Map()),
);

describe("acceptInvitation", () => {
  it.effect("creates the membership, marks invitation accepted, dispatches both events", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;
      const members = yield* MembershipRepository;
      const rec = yield* RecordedEvents;
      yield* inv.insertOne(seed());

      const orgId = yield* acceptInvitation(
        AcceptInvitationCommand.make({ token: "tok-abc", userId }),
      );
      deepStrictEqual(orgId, organizationId);

      const updated = yield* inv.findOneById(invitationId);
      deepStrictEqual(updated.acceptedAt !== null, true);

      const membership = yield* members.findOneByUserIdAndOrgId(userId, organizationId);
      deepStrictEqual(membership.userId, userId);

      const tags = (yield* rec.all).map((e) => e._tag);
      deepStrictEqual(tags.includes("InvitationAccepted"), true);
      deepStrictEqual(tags.includes("MembershipCreated"), true);

      const memberEvents = yield* rec.byTag<MembershipCreated>("MembershipCreated");
      const event = memberEvents[0];
      if (event === undefined) throw new Error("expected MembershipCreated event");
      deepStrictEqual(event.userId, userId);
      deepStrictEqual(event.organizationId, organizationId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationTokenNotFound when no invitation matches the token", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        acceptInvitation(AcceptInvitationCommand.make({ token: "missing", userId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof InvitationTokenNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationAlreadyAccepted on a second accept", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;
      const accepted = InvitationRootOps.accept(seed(), { userId, now });
      if (Result.isFailure(accepted)) throw new Error("expected Right");
      yield* inv.insertOne(accepted.success.invitation);

      const exit = yield* Effect.exit(
        acceptInvitation(AcceptInvitationCommand.make({ token: "tok-abc", userId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof InvitationAlreadyAccepted, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationRevoked when the invitation was revoked", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;
      const revoked = InvitationRootOps.revoke(seed(), { now });
      if (Result.isFailure(revoked)) throw new Error("expected Right");
      yield* inv.insertOne(revoked.success.invitation);

      const exit = yield* Effect.exit(
        acceptInvitation(AcceptInvitationCommand.make({ token: "tok-abc", userId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof InvitationRevoked, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  // `it.live` because `DateTime.now` inside the handler needs to read the
  // real wall clock — `it.effect`'s TestClock starts at the Unix epoch,
  // which would make a 2020-expiry NOT look expired.
  it.live("fails InvitationExpired when the invitation has expired", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;
      const expired = InvitationRootOps.issue({
        id: invitationId,
        organizationId,
        inviteeEmail: "alice@example.com",
        token: "tok-abc",
        expiresAt: DateTime.makeUnsafe(new Date("2020-01-01T00:00:00Z")),
        now: DateTime.makeUnsafe(new Date("2019-12-01T00:00:00Z")),
      }).invitation;
      yield* inv.insertOne(expired);

      const exit = yield* Effect.exit(
        acceptInvitation(AcceptInvitationCommand.make({ token: "tok-abc", userId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof InvitationExpired, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("rejects with SuperAdminCannotOwnOrganization when caller is a super-admin", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;
      yield* inv.insertOne(seed());

      const exit = yield* Effect.exit(
        acceptInvitation(
          AcceptInvitationCommand.make({ token: "tok-abc", userId: superAdminUserId }),
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
          InvitationRepositoryFake,
          MembershipRepositoryFake,
          RecordingEventBus,
          IdentityUnitOfWork,
          makeRoleServiceFake(new Map([[superAdminUserId, ["super_admin"]]])),
        ),
      ),
    ),
  );
});
