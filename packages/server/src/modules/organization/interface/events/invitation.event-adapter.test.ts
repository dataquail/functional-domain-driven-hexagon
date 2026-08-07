// Unit test for the invitation → email adapter. Asserts only the adapter glue
// (subscribe after commit + dispatch); the send itself is covered by the
// SendInvitationEmailCommand handler test, and the rendering by the mailer
// adapter's own test.

import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { makeEventBus, UnitOfWork } from "@org/cqrs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SendInvitationEmailCommand } from "@/modules/organization/commands/send-invitation-email.command.js";
import {
  InvitationIssued,
  InvitationReissued,
} from "@/modules/organization/domain/invitation/invitation.events.js";
import { InvitationEventAdapterLive } from "@/modules/organization/interface/events/invitation.event-adapter.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedCommands, RecordingCommandBus } from "@/test-utils/recording-command-bus.js";

const TestLayer = InvitationEventAdapterLive.pipe(
  Layer.provideMerge(makeEventBus()),
  Layer.provideMerge(RecordingCommandBus),
  Layer.provideMerge(IdentityUnitOfWork),
);

const invitationId = InvitationId.make("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.make("22222222-2222-2222-2222-222222222222");

describe("InvitationEventAdapterLive", () => {
  it.effect("dispatches SendInvitationEmailCommand for a newly issued invitation", () =>
    Effect.gen(function* () {
      const bus = yield* DomainEventBus;
      const uow = yield* UnitOfWork;
      const rec = yield* RecordedCommands;

      yield* uow.run(
        bus.dispatch([
          InvitationIssued.make({ invitationId, organizationId, inviteeEmail: "a@example.com" }),
        ]),
      );

      deepStrictEqual(yield* rec.payloadsFor(SendInvitationEmailCommand), [{ invitationId }]);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("dispatches it for a re-issued invitation too", () =>
    Effect.gen(function* () {
      const bus = yield* DomainEventBus;
      const uow = yield* UnitOfWork;
      const rec = yield* RecordedCommands;

      yield* uow.run(
        bus.dispatch([
          InvitationReissued.make({ invitationId, organizationId, inviteeEmail: "a@example.com" }),
        ]),
      );

      deepStrictEqual(yield* rec.payloadsFor(SendInvitationEmailCommand), [{ invitationId }]);
    }).pipe(Effect.provide(TestLayer)),
  );

  // The reason this is an after-commit subscription and not a plain one: the
  // dispatch must not have happened yet while the publisher's scope is still open.
  it.effect("does not dispatch until the publisher's unit of work has completed", () =>
    Effect.gen(function* () {
      const bus = yield* DomainEventBus;
      const uow = yield* UnitOfWork;
      const rec = yield* RecordedCommands;

      yield* uow.run(
        Effect.gen(function* () {
          yield* bus.dispatch([
            InvitationIssued.make({ invitationId, organizationId, inviteeEmail: "a@example.com" }),
          ]);
          deepStrictEqual(yield* rec.payloadsFor(SendInvitationEmailCommand), []);
        }),
      );

      deepStrictEqual(yield* rec.payloadsFor(SendInvitationEmailCommand), [{ invitationId }]);
    }).pipe(Effect.provide(TestLayer)),
  );
});
