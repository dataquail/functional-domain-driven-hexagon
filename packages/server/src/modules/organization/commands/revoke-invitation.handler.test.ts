import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { RevokeInvitationCommand } from "@/modules/organization/commands/revoke-invitation.command.js";
import { revokeInvitation } from "@/modules/organization/commands/revoke-invitation.handler.js";
import {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
  InvitationNotFound,
} from "@/modules/organization/domain/invitation.errors.js";
import { type InvitationRevoked } from "@/modules/organization/domain/invitation.events.js";
import {
  type InvitationRoot,
  InvitationRootOps,
} from "@/modules/organization/domain/invitation.root.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation.repository.js";
import { InvitationRepositoryFake } from "@/modules/organization/infrastructure/repositories/invitation.repository-fake.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const invitationId = InvitationId.make("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const actorUserId = UserId.make("33333333-3333-3333-3333-333333333333");
const userId = UserId.make("44444444-4444-4444-4444-444444444444");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));
const expiresAt = DateTime.makeUnsafe(new Date("2026-01-08T00:00:00Z"));

const seed = (): InvitationRoot =>
  InvitationRootOps.issue({
    id: invitationId,
    organizationId,
    inviteeEmail: "alice@example.com",
    token: "tok-abc",
    expiresAt,
    now,
  }).invitation;

const TestLayer = Layer.mergeAll(InvitationRepositoryFake, RecordingEventBus, IdentityUnitOfWork);

describe("revokeInvitation", () => {
  it.effect("marks invitation revoked and publishes InvitationRevoked", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const rec = yield* RecordedEvents;
      yield* repo.insertOne(seed());

      yield* revokeInvitation(RevokeInvitationCommand.make({ invitationId, actorUserId }));

      const updated = yield* repo.findOneById(invitationId);
      deepStrictEqual(updated.revokedAt !== null, true);

      const events = yield* rec.byTag<InvitationRevoked>("InvitationRevoked");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected InvitationRevoked event");
      deepStrictEqual(event.invitationId, invitationId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationNotFound when the id is unknown", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        revokeInvitation(RevokeInvitationCommand.make({ invitationId, actorUserId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof InvitationNotFound, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationAlreadyAccepted when the invitation was accepted", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const accepted = InvitationRootOps.accept(seed(), { userId, now });
      if (Result.isFailure(accepted)) throw new Error("expected Right");
      yield* repo.insertOne(accepted.success.invitation);

      const exit = yield* Effect.exit(
        revokeInvitation(RevokeInvitationCommand.make({ invitationId, actorUserId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof InvitationAlreadyAccepted, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationAlreadyRevoked on a second revoke", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const revoked = InvitationRootOps.revoke(seed(), { now });
      if (Result.isFailure(revoked)) throw new Error("expected Right");
      yield* repo.insertOne(revoked.success.invitation);

      const exit = yield* Effect.exit(
        revokeInvitation(RevokeInvitationCommand.make({ invitationId, actorUserId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof InvitationAlreadyRevoked, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
