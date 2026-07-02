import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { inviteUser } from "@/modules/organization/commands/invite-user.js";
import { InviteUserCommand } from "@/modules/organization/commands/invite-user-command.js";
import { type InvitationIssued } from "@/modules/organization/domain/invitation-events.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation-repository.js";
import {
  InvitationMailerFake,
  SentInvitations,
} from "@/modules/organization/infrastructure/external/invitation-mailer-fake.js";
import { InvitationRepositoryFake } from "@/modules/organization/infrastructure/invitation-repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const actorUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const organizationId = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

const TestLayer = Layer.mergeAll(
  InvitationRepositoryFake,
  RecordingEventBus,
  IdentityUnitOfWork,
  InvitationMailerFake,
);

describe("inviteUser", () => {
  it.effect("inserts an invitation, publishes InvitationIssued, sends one mail", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const rec = yield* RecordedEvents;
      const sent = yield* SentInvitations;
      const id = yield* inviteUser(
        InviteUserCommand.make({
          organizationId,
          inviteeEmail: "alice@example.com",
          ttlSeconds: 60 * 60 * 24 * 7,
          actorUserId,
        }),
      );
      const stored = yield* repo.findOneById(id);
      deepStrictEqual(stored.organizationId, organizationId);
      deepStrictEqual(stored.inviteeEmail, "alice@example.com");
      ok(stored.token.length > 0);

      const events = yield* rec.byTag<InvitationIssued>("InvitationIssued");
      deepStrictEqual(events.length, 1);
      const event = events[0];
      if (event === undefined) throw new Error("expected InvitationIssued event");
      deepStrictEqual(event.invitationId, id);
      deepStrictEqual(event.organizationId, organizationId);
      deepStrictEqual(event.inviteeEmail, "alice@example.com");

      const invites = yield* sent.all;
      deepStrictEqual(invites.length, 1);
      const invite = invites[0];
      if (invite === undefined) throw new Error("expected one sent invitation");
      deepStrictEqual(invite.to, "alice@example.com");
      // The use case hands the adapter the raw token; the adapter builds
      // the accept link. Asserting the token matches the persisted row
      // proves the invitee gets a link that resolves to this invitation.
      deepStrictEqual(invite.token, stored.token);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("inviting an email with an open invite reissues it instead of duplicating", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const sent = yield* SentInvitations;
      const make = () =>
        InviteUserCommand.make({
          organizationId,
          inviteeEmail: "alice@example.com",
          ttlSeconds: 60 * 60 * 24 * 7,
          actorUserId,
        });

      const firstId = yield* inviteUser(make());
      const firstToken = (yield* repo.findOneById(firstId)).token;

      const secondId = yield* inviteUser(make());

      // Same invitation row (dedup), with a rotated token.
      deepStrictEqual(secondId, firstId);
      const all = yield* repo.findManyByOrganizationId(organizationId);
      deepStrictEqual(all.length, 1);
      ok(all[0]?.token !== firstToken, "token should be rotated on reissue");

      // Two emails were sent (one per invite call), the latest with the new token.
      const invites = yield* sent.all;
      deepStrictEqual(invites.length, 2);
      deepStrictEqual(invites[1]?.token, all[0]?.token);
    }).pipe(Effect.provide(TestLayer)),
  );
});
