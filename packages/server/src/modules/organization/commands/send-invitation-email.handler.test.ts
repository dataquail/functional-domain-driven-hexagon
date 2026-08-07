import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { sendInvitationEmailHandler } from "@/modules/organization/commands/send-invitation-email.handler.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.js";
import {
  InvitationMailerFake,
  SentInvitations,
} from "@/modules/organization/infrastructure/clients/invitation-mailer.client-fake.js";
import { InvitationRepositoryFake } from "@/modules/organization/infrastructure/repositories/invitation.repository-fake.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

const invitationId = InvitationId.make("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const issuedAt = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));
const expiresAt = DateTime.makeUnsafe(new Date("2026-01-08T00:00:00Z"));

const seedInvitation = () =>
  InvitationRootOps.issue({
    id: invitationId,
    organizationId,
    inviteeEmail: "alice@example.com",
    token: "tok-stored",
    expiresAt,
    now: issuedAt,
  }).invitation;

const TestLayer = Layer.mergeAll(InvitationRepositoryFake, InvitationMailerFake);

describe("sendInvitationEmailHandler", () => {
  // The load-bearing assertion: the token in the email is the token on the row,
  // so the link the invitee follows resolves to *this* invitation.
  it.effect("sends the stored token and expiry to the invitee", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const sent = yield* SentInvitations;
      yield* repo.insertOne(seedInvitation());

      yield* sendInvitationEmailHandler({ invitationId });

      const invites = yield* sent.all;
      deepStrictEqual(invites.length, 1);
      const invite = invites[0];
      if (invite === undefined) throw new Error("expected one sent invitation");
      deepStrictEqual(invite.to, "alice@example.com");
      deepStrictEqual(invite.token, "tok-stored");
      deepStrictEqual(DateTime.toEpochMillis(invite.expiresAt), DateTime.toEpochMillis(expiresAt));
    }).pipe(Effect.provide(TestLayer)),
  );

  // This runs after its trigger committed, so the row can have been revoked and
  // deleted in between. Nobody is left to report that to, and there is nothing to
  // send — silence is the correct outcome, not a failure.
  it.effect("sends nothing when the invitation is gone", () =>
    Effect.gen(function* () {
      const sent = yield* SentInvitations;

      yield* sendInvitationEmailHandler({ invitationId });

      deepStrictEqual((yield* sent.all).length, 0);
    }).pipe(Effect.provide(TestLayer)),
  );
});
