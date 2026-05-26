import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { inviteUser } from "@/modules/organization/commands/invite-user.js";
import { InviteUserCommand } from "@/modules/organization/commands/invite-user-command.js";
import { type InvitationIssued } from "@/modules/organization/domain/invitation-events.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation-repository.js";
import { InvitationRepositoryFake } from "@/modules/organization/infrastructure/invitation-repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { MailerFake, SentMails } from "@/test-utils/mailer-fake.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const actorUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const organizationId = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

const TestLayer = Layer.mergeAll(
  InvitationRepositoryFake,
  RecordingEventBus,
  IdentityUnitOfWork,
  MailerFake,
);

describe("inviteUser", () => {
  it.effect("inserts an invitation, publishes InvitationIssued, sends one mail", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const rec = yield* RecordedEvents;
      const sent = yield* SentMails;
      const id = yield* inviteUser(
        InviteUserCommand.make({
          organizationId,
          inviteeEmail: "alice@example.com",
          ttlSeconds: 60 * 60 * 24 * 7,
          actorUserId,
        }),
      );
      const stored = yield* repo.findById(id);
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

      const mails = yield* sent.all;
      deepStrictEqual(mails.length, 1);
      const mail = mails[0];
      if (mail === undefined) throw new Error("expected one sent mail");
      deepStrictEqual(mail.to, "alice@example.com");
      ok(mail.body.includes(stored.token));
    }).pipe(Effect.provide(TestLayer)),
  );
});
