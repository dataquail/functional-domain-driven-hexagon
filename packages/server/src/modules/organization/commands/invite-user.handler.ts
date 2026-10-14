import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { InvitationId } from "@/globals/application/ddd/ids/invitation-id";
import { Spec } from "@/globals/application/ddd/specification";
import { DomainEventBus } from "@/globals/application/ports/event-bus";
import { type InviteUserPayload } from "@/modules/organization/commands/invite-user.command";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification";

export const inviteUserHandler = Effect.fn("inviteUserHandler")(function* (cmd: InviteUserPayload) {
  const repo = yield* InvitationRepository;
  const bus = yield* DomainEventBus;
  const crypto = yield* Crypto.Crypto;
  const now = yield* DateTime.now;
  // Opaque bearer credential the invitee presents to accept — 256 bits of
  // entropy, base64url. Randomness is impure, so it stays in the command
  // (the shell), never the domain.
  const token = Base64Url.encode(yield* Effect.orDie(crypto.randomBytes(32)));
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

  if (Option.isSome(openInvite)) {
    const result = InvitationRootOps.reissue(openInvite.value, { token, expiresAt, now });

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
    yield* Effect.annotateCurrentSpan("invitation.id", openInvite.value.id);

    return openInvite.value.id;
  }

  const id = InvitationId.make(yield* Effect.orDie(crypto.randomUUIDv4));

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
