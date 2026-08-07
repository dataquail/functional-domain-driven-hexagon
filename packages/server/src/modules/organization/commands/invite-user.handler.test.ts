import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { inviteUserHandler } from "@/modules/organization/commands/invite-user.handler.js";
import {
  type InvitationIssued,
  type InvitationReissued,
} from "@/modules/organization/domain/invitation/invitation.events.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.js";
import { InvitationRepositoryFake } from "@/modules/organization/infrastructure/repositories/invitation.repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const actorUserId = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const organizationId = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

const TestLayer = Layer.mergeAll(InvitationRepositoryFake, RecordingEventBus, IdentityUnitOfWork);

describe("inviteUserHandler", () => {
  it.effect("inserts an invitation and publishes InvitationIssued", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const rec = yield* RecordedEvents;
      const id = yield* inviteUserHandler({
        organizationId,
        inviteeEmail: "alice@example.com",
        ttlSeconds: 60 * 60 * 24 * 7,
        actorUserId,
      });
      const stored = yield* repo.findOne(InvitationSpecifications.withId(id));
      if (stored === null) throw new Error("expected invitation");
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
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("inviting an email with an open invite reissues it instead of duplicating", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const rec = yield* RecordedEvents;
      const make = () => ({
        organizationId,
        inviteeEmail: "alice@example.com",
        ttlSeconds: 60 * 60 * 24 * 7,
        actorUserId,
      });

      const firstId = yield* inviteUserHandler(make());
      const first = yield* repo.findOne(InvitationSpecifications.withId(firstId));
      if (first === null) throw new Error("expected invitation");
      const firstToken = first.token;

      const secondId = yield* inviteUserHandler(make());

      // Same invitation row (dedup), with a rotated token.
      deepStrictEqual(secondId, firstId);
      const all = yield* repo.findMany(InvitationSpecifications.forOrganization(organizationId));
      deepStrictEqual(all.length, 1);
      ok(all[0]?.token !== firstToken, "token should be rotated on reissue");

      // The second call re-issues rather than issues, so the mail-out reacts to a
      // different event — which is what tells the invitee their old link is dead.
      deepStrictEqual((yield* rec.byTag<InvitationIssued>("InvitationIssued")).length, 1);
      deepStrictEqual((yield* rec.byTag<InvitationReissued>("InvitationReissued")).length, 1);
    }).pipe(Effect.provide(TestLayer)),
  );
});
