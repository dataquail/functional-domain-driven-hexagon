import * as crypto from "node:crypto";

import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

import { type InviteUserPayload } from "@/modules/organization/commands/invite-user.command.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.js";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";

export const inviteUserHandler = Effect.fn("inviteUserHandler")(function* (cmd: InviteUserPayload) {
  const repo = yield* InvitationRepository;
  const bus = yield* DomainEventBus;
  const now = yield* DateTime.now;
  // Opaque bearer credential the invitee presents to accept — 256 bits of
  // entropy, base64url. Randomness is impure, so it stays in the command
  // (the shell), never the domain.
  const token = yield* Effect.sync(() => crypto.randomBytes(32).toString("base64url"));
  const expiresAt = DateTime.add(now, { seconds: cmd.ttlSeconds });

  // Invite-again-becomes-resend: if an open invite already exists for
  // this (org, email), reissue it (fresh token + expiry) instead of
  // creating a duplicate row, so the pending list stays one-per-email.
  // Key eqs + the `isOpen` variant compose into one spec; the repository
  // compiles the whole predicate to SQL and returns at most one row.
  const openInvite = yield* repo.findOne(
    Spec.and(
      InvitationSpecifications.forOrganization(cmd.organizationId),
      InvitationSpecifications.withInviteeEmail(cmd.inviteeEmail),
      InvitationSpecifications.isOpen,
    ),
  );
  if (openInvite !== null) {
    const result = InvitationRootOps.reissue(openInvite, { token, expiresAt, now });
    // `openInvite` is open by construction, so reissue can't reject it; a
    // failure here would mean a concurrent accept/revoke — treat as a
    // defect (same posture as the accept handler's concurrent-revoke).
    if (Result.isFailure(result)) return yield* Effect.die(result.failure);
    // The row was found moments ago; a missing row on update means a
    // concurrent delete — a defect, not a caller-visible error (keeps
    // InviteUserCommand's failure channel to PersistenceUnavailable).
    yield* repo
      .updateOne(result.success.invitation)
      .pipe(Effect.catchTag("InvitationNotFound", Effect.die));
    yield* bus.dispatch(result.success.events);
    yield* Effect.annotateCurrentSpan("invitation.id", openInvite.id);
    return openInvite.id;
  }
  const id = InvitationId.make(crypto.randomUUID());
  const { events, invitation } = InvitationRootOps.issue({
    id,
    organizationId: cmd.organizationId,
    inviteeEmail: cmd.inviteeEmail,
    token,
    expiresAt,
    now,
  });
  yield* repo.insertOne(invitation);
  yield* bus.dispatch(events);
  yield* Effect.annotateCurrentSpan("invitation.id", id);
  return id;
}, withUnitOfWork);
