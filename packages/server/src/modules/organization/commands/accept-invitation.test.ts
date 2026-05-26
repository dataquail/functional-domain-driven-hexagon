import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { acceptInvitation } from "@/modules/organization/commands/accept-invitation.js";
import { AcceptInvitationCommand } from "@/modules/organization/commands/accept-invitation-command.js";
import * as Invitation from "@/modules/organization/domain/invitation.aggregate.js";
import {
  InvitationAlreadyAccepted,
  InvitationExpired,
  InvitationRevoked,
  InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation-errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation-repository.js";
import { type MembershipCreated } from "@/modules/organization/domain/membership-events.js";
import { MembershipRepository } from "@/modules/organization/domain/membership-repository.js";
import { InvitationRepositoryFake } from "@/modules/organization/infrastructure/invitation-repository-fake.js";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/membership-repository-fake.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const invitationId = InvitationId.make("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.unsafeMake(new Date("2026-01-01T00:00:00Z"));
const inOneWeek = DateTime.unsafeMake(new Date("2026-01-08T00:00:00Z"));

const seed = (): Invitation.Invitation =>
  Invitation.issue({
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
);

describe("acceptInvitation", () => {
  it.effect("creates the membership, marks invitation accepted, dispatches both events", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;
      const members = yield* MembershipRepository;
      const rec = yield* RecordedEvents;
      yield* inv.insert(seed());

      const orgId = yield* acceptInvitation(
        AcceptInvitationCommand.make({ token: "tok-abc", userId }),
      );
      deepStrictEqual(orgId, organizationId);

      const updated = yield* inv.findById(invitationId);
      deepStrictEqual(updated.acceptedAt !== null, true);

      const membership = yield* members.findByUserIdAndOrgId(userId, organizationId);
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
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof InvitationTokenNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationAlreadyAccepted on a second accept", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;
      const accepted = Invitation.accept(seed(), { userId, now });
      if (Either.isLeft(accepted)) throw new Error("expected Right");
      yield* inv.insert(accepted.right.invitation);

      const exit = yield* Effect.exit(
        acceptInvitation(AcceptInvitationCommand.make({ token: "tok-abc", userId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof InvitationAlreadyAccepted, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationRevoked when the invitation was revoked", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;
      const revoked = Invitation.revoke(seed(), { now });
      if (Either.isLeft(revoked)) throw new Error("expected Right");
      yield* inv.insert(revoked.right.invitation);

      const exit = yield* Effect.exit(
        acceptInvitation(AcceptInvitationCommand.make({ token: "tok-abc", userId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
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
      const expired = Invitation.issue({
        id: invitationId,
        organizationId,
        inviteeEmail: "alice@example.com",
        token: "tok-abc",
        expiresAt: DateTime.unsafeMake(new Date("2020-01-01T00:00:00Z")),
        now: DateTime.unsafeMake(new Date("2019-12-01T00:00:00Z")),
      }).invitation;
      yield* inv.insert(expired);

      const exit = yield* Effect.exit(
        acceptInvitation(AcceptInvitationCommand.make({ token: "tok-abc", userId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof InvitationExpired, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
