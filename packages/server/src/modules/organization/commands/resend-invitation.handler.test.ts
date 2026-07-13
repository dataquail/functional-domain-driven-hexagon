import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as TestClock from "effect/testing/TestClock";

import { ResendInvitationCommand } from "@/modules/organization/commands/resend-invitation.command.js";
import { resendInvitation } from "@/modules/organization/commands/resend-invitation.handler.js";
import {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
} from "@/modules/organization/domain/invitation/invitation.errors.js";
import { type InvitationReissued } from "@/modules/organization/domain/invitation/invitation.events.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.js";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.js";
import {
  InvitationMailerFake,
  SentInvitations,
} from "@/modules/organization/infrastructure/clients/invitation-mailer.client-fake.js";
import { InvitationRepositoryFake } from "@/modules/organization/infrastructure/repositories/invitation.repository-fake.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const invitationId = InvitationId.make("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const actorUserId = UserId.make("33333333-3333-3333-3333-333333333333");
const issuedAt = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));
const originalExpiry = DateTime.makeUnsafe(new Date("2026-01-08T00:00:00Z"));
// `it.effect` runs on a TestClock starting at epoch 0; pin it past the
// original expiry so the reissued expiry is demonstrably pushed out.
const clockNow = DateTime.makeUnsafe(new Date("2026-06-01T00:00:00Z"));

const seedInvitation = () =>
  InvitationRootOps.issue({
    id: invitationId,
    organizationId,
    inviteeEmail: "alice@example.com",
    token: "tok-original",
    expiresAt: originalExpiry,
    now: issuedAt,
  }).invitation;

const TestLayer = Layer.mergeAll(
  InvitationRepositoryFake,
  RecordingEventBus,
  IdentityUnitOfWork,
  InvitationMailerFake,
);

const cmd = ResendInvitationCommand.make({
  invitationId,
  ttlSeconds: 60 * 60 * 24 * 7,
  actorUserId,
});

describe("resendInvitation", () => {
  it.effect("rotates the token, resets expiry, emits InvitationReissued, re-sends the email", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
      const repo = yield* InvitationRepository;
      const rec = yield* RecordedEvents;
      const sent = yield* SentInvitations;
      yield* repo.insertOne(seedInvitation());

      yield* resendInvitation(cmd);

      const stored = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
      if (stored === null) throw new Error("expected invitation");
      ok(stored.token !== "tok-original", "token should be rotated");
      ok(DateTime.isGreaterThan(stored.expiresAt, originalExpiry), "expiry should be pushed out");
      deepStrictEqual(stored.acceptedAt, null);
      deepStrictEqual(stored.revokedAt, null);

      const events = yield* rec.byTag<InvitationReissued>("InvitationReissued");
      deepStrictEqual(events.length, 1);

      const invites = yield* sent.all;
      deepStrictEqual(invites.length, 1);
      const invite = invites[0];
      if (invite === undefined) throw new Error("expected one sent invitation");
      deepStrictEqual(invite.to, "alice@example.com");
      // The re-sent email carries the freshly rotated token.
      deepStrictEqual(invite.token, stored.token);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationAlreadyRevoked when the invitation was revoked", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const revoked = InvitationRootOps.revoke(seedInvitation(), { now: issuedAt });
      if (Result.isFailure(revoked)) throw new Error("expected Right");
      yield* repo.insertOne(revoked.success.invitation);

      const exit = yield* Effect.exit(resendInvitation(cmd));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof InvitationAlreadyRevoked, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationAlreadyAccepted when the invitation was accepted", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const accepted = InvitationRootOps.accept(seedInvitation(), {
        userId: actorUserId,
        now: issuedAt,
      });
      if (Result.isFailure(accepted)) throw new Error("expected Right");
      yield* repo.insertOne(accepted.success.invitation);

      const exit = yield* Effect.exit(resendInvitation(cmd));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof InvitationAlreadyAccepted, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
