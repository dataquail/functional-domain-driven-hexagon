import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as TestClock from "effect/testing/TestClock";

import { resendInvitationHandler } from "@/modules/organization/commands/resend-invitation.handler.js";
import {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
} from "@/modules/organization/domain/invitation/invitation.errors.js";
import { type InvitationReissued } from "@/modules/organization/domain/invitation/invitation.events.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.js";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.js";
import { InvitationRepositoryFake } from "@/modules/organization/infrastructure/repositories/invitation.repository-fake.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
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
  PassThroughUnitOfWork,
);

const cmd = {
  invitationId,
  ttlSeconds: 60 * 60 * 24 * 7,
  actorUserId,
};

describe("resendInvitationHandler", () => {
  it.effect("rotates the token, resets expiry and emits InvitationReissued", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
      const repo = yield* InvitationRepository;
      const rec = yield* RecordedEvents;
      yield* repo.insertOne(seedInvitation());

      yield* resendInvitationHandler(cmd);

      const stored = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
      if (stored === null) throw new Error("expected invitation");
      ok(stored.token !== "tok-original", "token should be rotated");
      ok(DateTime.isGreaterThan(stored.expiresAt, originalExpiry), "expiry should be pushed out");
      deepStrictEqual(stored.acceptedAt, null);
      deepStrictEqual(stored.revokedAt, null);

      const events = yield* rec.byTag<InvitationReissued>("InvitationReissued");
      deepStrictEqual(events.length, 1);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationAlreadyRevoked when the invitation was revoked", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const revoked = Result.getOrThrow(
        InvitationRootOps.revoke(seedInvitation(), { now: issuedAt }),
      );
      yield* repo.insertOne(revoked.invitation);

      const exit = yield* Effect.exit(resendInvitationHandler(cmd));
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
      const accepted = Result.getOrThrow(
        InvitationRootOps.accept(seedInvitation(), {
          userId: actorUserId,
          now: issuedAt,
        }),
      );
      yield* repo.insertOne(accepted.invitation);

      const exit = yield* Effect.exit(resendInvitationHandler(cmd));
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
