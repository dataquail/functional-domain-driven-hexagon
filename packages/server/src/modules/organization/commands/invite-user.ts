import * as crypto from "node:crypto";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type InviteUserCommand,
  type InviteUserOutput,
} from "@/modules/organization/commands/invite-user-command.js";
import * as Invitation from "@/modules/organization/domain/invitation.aggregate.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation-repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { Mailer } from "@/platform/notifications/mailer.js";

// Token is the bearer credential the invitee uses to accept — 256 bits
// of entropy in URL-safe base64. Bigger than strictly necessary but
// cheap and immune to collision concerns. Generated in the handler
// (not the aggregate) because randomness is an infrastructure concern.
const generateToken = (): string =>
  crypto
    .randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const inviteUser = (cmd: InviteUserCommand): InviteUserOutput =>
  Effect.gen(function* () {
    const repo = yield* InvitationRepository;
    const bus = yield* DomainEventBus;
    const mailer = yield* Mailer;
    const now = yield* DateTime.now;
    const id = InvitationId.make(crypto.randomUUID());
    const token = generateToken();
    const expiresAt = DateTime.add(now, { seconds: cmd.ttlSeconds });
    const { events, invitation } = Invitation.issue({
      id,
      organizationId: cmd.organizationId,
      inviteeEmail: cmd.inviteeEmail,
      token,
      expiresAt,
      now,
    });
    yield* Effect.annotateCurrentSpan("invitation.id", id);
    yield* Effect.gen(function* () {
      yield* repo.insert(invitation);
      yield* bus.dispatch(events);
    }).pipe(withUnitOfWork);
    // Fire after the UoW commits — the email may include the token, so
    // we don't want to send it on a transaction that ends up rolled back.
    yield* mailer.send({
      to: cmd.inviteeEmail,
      subject: "You're invited to join an organization",
      body: `You have been invited. Use this token to accept: ${token}`,
    });
    return id;
  });
