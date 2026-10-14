import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Option from "effect/Option";

import { DomainEventBus } from "@/globals/application/ports/event-bus.js";
import { type ResendInvitationPayload } from "@/modules/organization/commands/resend-invitation.command.js";
import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.js";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.js";

// Resend = re-issue: rotate the token and reset the expiry on an open
// invitation. The previous link stops working. Reissue refuses
// accepted/revoked invitations (the aggregate enforces it), which the
// endpoint maps to 410 Gone — same shape as revoke.
//
// Re-sending the email is a reaction to `InvitationReissued`, not a step here.
export const resendInvitationHandler = Effect.fn("resendInvitationHandler")(function* (
  cmd: ResendInvitationPayload,
) {
  const repo = yield* InvitationRepository;
  const bus = yield* DomainEventBus;
  const crypto = yield* Crypto.Crypto;
  const now = yield* DateTime.now;
  // Fresh opaque bearer credential (256 bits, base64url). Randomness is
  // impure, so it stays in the command (the shell), never the domain.
  const token = Base64Url.encode(yield* Effect.orDie(crypto.randomBytes(32)));
  const expiresAt = DateTime.add(now, { seconds: cmd.ttlSeconds });

  const maybeInvitation = yield* repo.findOne(InvitationSpecifications.withId(cmd.invitationId));

  if (Option.isNone(maybeInvitation)) {
    return yield* new InvitationNotFound({ invitationId: cmd.invitationId });
  }

  const invitation = maybeInvitation.value;

  const result = yield* Effect.fromResult(
    InvitationRootOps.reissue(invitation, { token, expiresAt, now }),
  );

  yield* repo.updateOne(result.invitation);
  yield* bus.dispatch(result.events);
  yield* Effect.annotateCurrentSpan("invitation.id", cmd.invitationId);
}, withUnitOfWork);
